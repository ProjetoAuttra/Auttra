import { prisma } from "../prisma/client.js";
import { canAccess, type PermissionsMap } from "../permissions/accessProfiles.js";
import { periodoDe } from "./relatorios.service.js";
import { RecursosAdicionaisService } from "./recursosAdicionais.service.js";

/**
 * Resumo da tela de inicio. Cada bloco so e calculado se o usuario tem o modulo correspondente
 * (e, para agenda e estoque, se o recurso esta habilitado na oficina); o que nao vier foi omitido.
 */

const FUSO = "America/Sao_Paulo";
const DIA_MS = 24 * 60 * 60 * 1000;

// Mesmos criterios dos relatorios de ordens paradas, estoque critico e orcamentos perdidos.
const DIAS_OS_PARADA = 5;
const DIAS_ORCAMENTO_SEM_RESPOSTA = 3;
const LIMITE_ESTOQUE_BAIXO = 3;
const DIAS_GRAFICO = 8;
const ITENS_AGENDA = 5;

const num = (v: unknown) => Number(v ?? 0);
const arred = (v: number) => Math.round(v * 100) / 100;
const hojeISO = () => new Date().toLocaleDateString("en-CA", { timeZone: FUSO });
const somaDias = (iso: string, n: number) => new Date(new Date(`${iso}T12:00:00-03:00`).getTime() + n * DIA_MS).toLocaleDateString("en-CA", { timeZone: FUSO });

export type AtencaoChave = "ordens_paradas" | "contas_vencidas" | "orcamentos_sem_resposta" | "estoque_critico" | "contas_pagar_amanha";

export type ItemAtencao = { chave: AtencaoChave; quantidade: number; valor?: number; dias?: number };

async function financeiro(oficinaId: number, hoje: string) {
  const periodo = periodoDe(`${hoje.slice(0, 8)}01`, hoje);
  const inicioGrafico = new Date(`${somaDias(hoje, -(DIAS_GRAFICO - 1))}T00:00:00-03:00`);
  const fimGrafico = new Date(new Date(`${hoje}T00:00:00-03:00`).getTime() + DIA_MS);

  const faturado = (ini: Date, fim: Date) => prisma.$queryRaw<Array<{ total: unknown }>>`
    SELECT COALESCE(SUM(valor_total), 0) AS total
    FROM ordem_servico
    WHERE oficina_id = ${oficinaId} AND deleted_at IS NULL AND status = 'concluida'
      AND COALESCE(data_fechamento, updated_at) >= ${ini} AND COALESCE(data_fechamento, updated_at) < ${fim}
  `;

  const [[atual], [anterior], dias, [receber], [pagar]] = await Promise.all([
    faturado(periodo.inicio, periodo.fim),
    faturado(periodo.anterior.inicio, periodo.anterior.fim),
    prisma.$queryRaw<Array<{ dia: string; total: unknown }>>`
      -- colunas timestamp sem fuso guardam UTC: converte para UTC e so depois para o fuso da oficina
      SELECT to_char((COALESCE(data_fechamento, updated_at) AT TIME ZONE 'UTC') AT TIME ZONE ${FUSO}, 'YYYY-MM-DD') AS dia, SUM(valor_total) AS total
      FROM ordem_servico
      WHERE oficina_id = ${oficinaId} AND deleted_at IS NULL AND status = 'concluida'
        AND COALESCE(data_fechamento, updated_at) >= ${inicioGrafico} AND COALESCE(data_fechamento, updated_at) < ${fimGrafico}
      GROUP BY 1
    `,
    prisma.$queryRaw<Array<{ hoje: unknown; vencido: unknown; qtd_vencidas: bigint }>>`
      SELECT
        COALESCE(SUM(valor_original - desconto - valor_pago) FILTER (WHERE data_vencimento::date = ${hoje}::date), 0) AS hoje,
        COALESCE(SUM(valor_original - desconto - valor_pago) FILTER (WHERE data_vencimento::date < ${hoje}::date), 0) AS vencido,
        COUNT(*) FILTER (WHERE data_vencimento::date < ${hoje}::date) AS qtd_vencidas
      FROM pagamento
      WHERE oficina_id = ${oficinaId} AND deleted_at IS NULL AND tipo = 'receber' AND status IN ('pendente', 'parcial')
    `,
    prisma.$queryRaw<Array<{ semana: unknown; amanha: unknown; qtd_amanha: bigint }>>`
      SELECT
        COALESCE(SUM(valor_original - desconto - valor_pago) FILTER (WHERE data_vencimento::date BETWEEN ${hoje}::date AND ${somaDias(hoje, 6)}::date), 0) AS semana,
        COALESCE(SUM(valor_original - desconto - valor_pago) FILTER (WHERE data_vencimento::date = ${somaDias(hoje, 1)}::date), 0) AS amanha,
        COUNT(*) FILTER (WHERE data_vencimento::date = ${somaDias(hoje, 1)}::date) AS qtd_amanha
      FROM pagamento
      WHERE oficina_id = ${oficinaId} AND deleted_at IS NULL AND tipo = 'pagar' AND status IN ('pendente', 'parcial')
    `,
  ]);

  const totalMes = arred(num(atual?.total));
  const totalAnterior = arred(num(anterior?.total));
  const porDia = new Map(dias.map((d) => [d.dia, arred(num(d.total))]));

  return {
    resumo: {
      faturamento_mes: totalMes,
      variacao_percentual: totalAnterior > 0 ? arred(((totalMes - totalAnterior) / totalAnterior) * 100) : null,
      dias: Array.from({ length: DIAS_GRAFICO }, (_, i) => {
        const data = somaDias(hoje, i - (DIAS_GRAFICO - 1));
        return { data, total: porDia.get(data) ?? 0 };
      }),
      a_receber_hoje: arred(num(receber?.hoje)),
      a_receber_vencido: arred(num(receber?.vencido)),
      a_pagar_semana: arred(num(pagar?.semana)),
      contas_pagar_amanha: Number(pagar?.qtd_amanha ?? 0),
    },
    contasVencidas: { quantidade: Number(receber?.qtd_vencidas ?? 0), valor: arred(num(receber?.vencido)) },
    contasPagarAmanha: { quantidade: Number(pagar?.qtd_amanha ?? 0), valor: arred(num(pagar?.amanha)) },
  };
}

async function ordensParadas(oficinaId: number) {
  const limite = new Date(Date.now() - DIAS_OS_PARADA * DIA_MS);
  const [r] = await prisma.$queryRaw<Array<{ qtd: bigint; antiga: Date | null }>>`
    SELECT COUNT(*) AS qtd, MIN(data_abertura) AS antiga
    FROM ordem_servico
    WHERE oficina_id = ${oficinaId} AND deleted_at IS NULL AND status IN ('aberta', 'em_andamento') AND data_abertura <= ${limite}
  `;
  return { quantidade: Number(r?.qtd ?? 0), dias: r?.antiga ? Math.floor((Date.now() - r.antiga.getTime()) / DIA_MS) : 0 };
}

async function orcamentosSemResposta(oficinaId: number) {
  const limite = new Date(Date.now() - DIAS_ORCAMENTO_SEM_RESPOSTA * DIA_MS);
  const [r] = await prisma.$queryRaw<Array<{ qtd: bigint }>>`
    SELECT COUNT(*) AS qtd
    FROM orcamento o JOIN cliente c ON c.id = o.cliente_id
    WHERE c.oficina_id = ${oficinaId} AND o.deleted_at IS NULL AND o.status = 'analise' AND o.created_at <= ${limite}
  `;
  return Number(r?.qtd ?? 0);
}

async function estoqueCritico(oficinaId: number) {
  return prisma.peca.count({ where: { oficina_id: oficinaId, deleted_at: null, estoque: { lte: LIMITE_ESTOQUE_BAIXO } } });
}

async function agendaHoje(oficinaId: number, hoje: string) {
  const inicio = new Date(`${hoje}T00:00:00-03:00`);
  const fim = new Date(inicio.getTime() + DIA_MS);
  const where = { oficina_id: oficinaId, deleted_at: null, status: { not: "cancelado" as const }, data_inicio: { gte: inicio, lt: fim } };
  const [total, itens] = await Promise.all([
    prisma.agendamento.count({ where }),
    prisma.agendamento.findMany({
      where,
      orderBy: { data_inicio: "asc" },
      take: ITENS_AGENDA,
      select: {
        id: true,
        titulo: true,
        data_inicio: true,
        status: true,
        cliente: { select: { nome: true } },
        veiculo: { select: { marca: true, modelo: true } },
      },
    }),
  ]);
  return {
    total,
    itens: itens.map((a) => ({
      id: a.id,
      inicio: a.data_inicio.toISOString(),
      titulo: a.titulo,
      status: a.status,
      cliente: a.cliente?.nome ?? "Sem cliente",
      veiculo: [a.veiculo?.marca, a.veiculo?.modelo].filter(Boolean).join(" "),
    })),
  };
}

export const PainelService = {
  async resumo(oficinaId: number, permissoes: PermissionsMap | undefined) {
    const hoje = hojeISO();
    const pode = (m: Parameters<typeof canAccess>[1]) => canAccess(permissoes, m, "read");
    const recursos = await RecursosAdicionaisService.get(oficinaId);

    const [fin, paradas, orcamentos, criticas, agenda] = await Promise.all([
      pode("financeiro") ? financeiro(oficinaId, hoje) : null,
      pode("ordens") ? ordensParadas(oficinaId) : null,
      pode("orcamentos") ? orcamentosSemResposta(oficinaId) : null,
      pode("estoque") && recursos.estoque ? estoqueCritico(oficinaId) : null,
      pode("agenda") && recursos.agenda ? agendaHoje(oficinaId, hoje) : null,
    ]);

    const atencao: ItemAtencao[] = [];
    if (paradas?.quantidade) atencao.push({ chave: "ordens_paradas", quantidade: paradas.quantidade, dias: paradas.dias });
    if (fin?.contasVencidas.quantidade) atencao.push({ chave: "contas_vencidas", ...fin.contasVencidas });
    if (orcamentos) atencao.push({ chave: "orcamentos_sem_resposta", quantidade: orcamentos });
    if (criticas) atencao.push({ chave: "estoque_critico", quantidade: criticas });
    if (fin?.contasPagarAmanha.quantidade) atencao.push({ chave: "contas_pagar_amanha", ...fin.contasPagarAmanha });

    return {
      financeiro: fin?.resumo ?? null,
      atencao: atencao.filter((a) => a.quantidade > 0),
      agenda: agenda ?? null,
    };
  },
};
