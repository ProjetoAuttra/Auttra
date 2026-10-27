import { prisma } from "../prisma/client.js";
import { HttpError } from "../utils/httpError.js";

/**
 * Relatorios agregados no banco, para nao depender de carregar todas as linhas no navegador.
 * Periodos sao datas de calendario (YYYY-MM-DD) no fuso de Brasilia, inclusive nas duas pontas.
 */

const FUSO = "America/Sao_Paulo";
const DIA_MS = 24 * 60 * 60 * 1000;

const num = (v: unknown) => Number(v ?? 0);
const arred = (v: number) => Math.round(v * 100) / 100;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function hojeISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: FUSO });
}

export type Periodo = { inicio: Date; fim: Date; inicioISO: string; fimISO: string; anterior: { inicio: Date; fim: Date } };

/** `fim` e exclusivo (00:00 do dia seguinte). O periodo anterior tem a mesma duracao e termina quando este comeca. */
export function periodoDe(from?: unknown, to?: unknown): Periodo {
  const hoje = hojeISO();
  const inicioISO = typeof from === "string" && from ? from : `${hoje.slice(0, 8)}01`;
  const fimISO = typeof to === "string" && to ? to : hoje;
  if (!ISO.test(inicioISO) || !ISO.test(fimISO)) throw new HttpError("Periodo invalido. Use datas no formato AAAA-MM-DD.", 400);

  const inicio = new Date(`${inicioISO}T00:00:00-03:00`);
  const fim = new Date(new Date(`${fimISO}T00:00:00-03:00`).getTime() + DIA_MS);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim <= inicio)
    throw new HttpError("Periodo invalido: a data final deve ser igual ou posterior a inicial.", 400);
  if ((fim.getTime() - inicio.getTime()) / DIA_MS > 366) throw new HttpError("O periodo maximo e de 366 dias.", 400);

  const duracao = fim.getTime() - inicio.getTime();
  return { inicio, fim, inicioISO, fimISO, anterior: { inicio: new Date(inicio.getTime() - duracao), fim: inicio } };
}

const variacao = (atual: number, anterior: number) => (anterior > 0 ? arred(((atual - anterior) / anterior) * 100) : null);

export const RelatoriosService = {
  /** Contas a receber vencidas, por faixa de atraso e por cliente. */
  async inadimplencia(oficinaId: number) {
    const hoje = hojeISO();

    const faixas = await prisma.$queryRaw<Array<{ faixa: string; quantidade: bigint; valor: unknown }>>`
      SELECT
        CASE
          WHEN (${hoje}::date - p.data_vencimento::date) <= 30 THEN '1-30'
          WHEN (${hoje}::date - p.data_vencimento::date) <= 60 THEN '31-60'
          WHEN (${hoje}::date - p.data_vencimento::date) <= 90 THEN '61-90'
          ELSE '90+'
        END AS faixa,
        COUNT(*) AS quantidade,
        SUM(p.valor_original - p.desconto - p.valor_pago) AS valor
      FROM pagamento p
      WHERE p.oficina_id = ${oficinaId} AND p.deleted_at IS NULL AND p.tipo = 'receber'
        AND p.status IN ('pendente', 'parcial') AND p.data_vencimento::date < ${hoje}::date
      GROUP BY 1
    `;

    const clientes = await prisma.$queryRaw<Array<{ cliente_id: number | null; nome: string | null; titulos: bigint; valor: unknown; dias_max: number }>>`
      SELECT p.cliente_id, c.nome, COUNT(*) AS titulos,
             SUM(p.valor_original - p.desconto - p.valor_pago) AS valor,
             MAX(${hoje}::date - p.data_vencimento::date) AS dias_max
      FROM pagamento p
      LEFT JOIN cliente c ON c.id = p.cliente_id
      WHERE p.oficina_id = ${oficinaId} AND p.deleted_at IS NULL AND p.tipo = 'receber'
        AND p.status IN ('pendente', 'parcial') AND p.data_vencimento::date < ${hoje}::date
      GROUP BY p.cliente_id, c.nome
      ORDER BY valor DESC
      LIMIT 20
    `;

    const [carteira] = await prisma.$queryRaw<Array<{ total: unknown; clientes: bigint }>>`
      SELECT SUM(p.valor_original - p.desconto - p.valor_pago) AS total,
             COUNT(DISTINCT p.cliente_id) FILTER (WHERE p.data_vencimento::date < ${hoje}::date) AS clientes
      FROM pagamento p
      WHERE p.oficina_id = ${oficinaId} AND p.deleted_at IS NULL AND p.tipo = 'receber' AND p.status IN ('pendente', 'parcial')
    `;

    const ordem = ["1-30", "31-60", "61-90", "90+"];
    const porFaixa = ordem.map((f) => {
      const achada = faixas.find((x) => x.faixa === f);
      return { faixa: f, quantidade: Number(achada?.quantidade ?? 0), valor: arred(num(achada?.valor)) };
    });
    const totalVencido = arred(porFaixa.reduce((s, f) => s + f.valor, 0));
    const totalCarteira = arred(num(carteira?.total));

    return {
      total_vencido: totalVencido,
      titulos_vencidos: porFaixa.reduce((s, f) => s + f.quantidade, 0),
      clientes_inadimplentes: Number(carteira?.clientes ?? 0),
      total_a_receber: totalCarteira,
      percentual_carteira: totalCarteira > 0 ? arred((totalVencido / totalCarteira) * 100) : 0,
      faixas: porFaixa,
      clientes: clientes.map((c) => ({
        cliente_id: c.cliente_id,
        nome: c.nome ?? "Sem cliente",
        titulos: Number(c.titulos),
        valor: arred(num(c.valor)),
        dias_atraso: Number(c.dias_max),
      })),
    };
  },

  /** Faturamento = valor das OS concluidas no periodo (data de fechamento). */
  async faturamento(oficinaId: number, p: Periodo) {
    const base = (ini: Date, fim: Date) => prisma.$queryRaw<Array<{ total: unknown; qtd: bigint }>>`
      SELECT COALESCE(SUM(valor_total), 0) AS total, COUNT(*) AS qtd
      FROM ordem_servico
      WHERE oficina_id = ${oficinaId} AND deleted_at IS NULL AND status = 'concluida'
        AND COALESCE(data_fechamento, updated_at) >= ${ini} AND COALESCE(data_fechamento, updated_at) < ${fim}
    `;
    const [[atual], [anterior]] = await Promise.all([base(p.inicio, p.fim), base(p.anterior.inicio, p.anterior.fim)]);

    const semanas = await prisma.$queryRaw<Array<{ semana: string; total: unknown; qtd: bigint }>>`
      SELECT to_char(date_trunc('week', COALESCE(data_fechamento, updated_at) AT TIME ZONE ${FUSO}), 'YYYY-MM-DD') AS semana,
             SUM(valor_total) AS total, COUNT(*) AS qtd
      FROM ordem_servico
      WHERE oficina_id = ${oficinaId} AND deleted_at IS NULL AND status = 'concluida'
        AND COALESCE(data_fechamento, updated_at) >= ${p.inicio} AND COALESCE(data_fechamento, updated_at) < ${p.fim}
      GROUP BY 1 ORDER BY 1
    `;

    const composicao = await prisma.$queryRaw<Array<{ tipo: string; total: unknown }>>`
      SELECT i.tipo_item::text AS tipo, SUM(i.subtotal) AS total
      FROM item_ordem_servico i
      JOIN ordem_servico o ON o.id = i.ordem_servico_id
      WHERE o.oficina_id = ${oficinaId} AND o.deleted_at IS NULL AND o.status = 'concluida' AND i.deleted_at IS NULL
        AND COALESCE(o.data_fechamento, o.updated_at) >= ${p.inicio} AND COALESCE(o.data_fechamento, o.updated_at) < ${p.fim}
      GROUP BY 1
    `;

    const clientes = await prisma.$queryRaw<Array<{ nome: string | null; total: unknown; qtd: bigint }>>`
      SELECT c.nome, SUM(o.valor_total) AS total, COUNT(*) AS qtd
      FROM ordem_servico o LEFT JOIN cliente c ON c.id = o.cliente_id
      WHERE o.oficina_id = ${oficinaId} AND o.deleted_at IS NULL AND o.status = 'concluida'
        AND COALESCE(o.data_fechamento, o.updated_at) >= ${p.inicio} AND COALESCE(o.data_fechamento, o.updated_at) < ${p.fim}
      GROUP BY c.nome ORDER BY total DESC LIMIT 5
    `;

    const total = arred(num(atual?.total));
    const qtd = Number(atual?.qtd ?? 0);
    const totalAnterior = arred(num(anterior?.total));
    const valorDe = (t: string) => arred(num(composicao.find((c) => c.tipo === t)?.total));

    return {
      periodo: { de: p.inicioISO, ate: p.fimISO },
      total,
      ordens_concluidas: qtd,
      ticket_medio: qtd ? arred(total / qtd) : 0,
      periodo_anterior: { total: totalAnterior, ordens_concluidas: Number(anterior?.qtd ?? 0) },
      variacao_percentual: variacao(total, totalAnterior),
      semanas: semanas.map((s) => ({ semana: s.semana, total: arred(num(s.total)), ordens: Number(s.qtd) })),
      composicao: { servicos: valorDe("servico"), pecas: valorDe("peca") },
      clientes: clientes.map((c) => ({ nome: c.nome ?? "Sem cliente", total: arred(num(c.total)), ordens: Number(c.qtd) })),
    };
  },

  /** Desempenho por mecanico: OS concluidas, faturamento, ticket medio, custo de pecas e margem. */
  async mecanicos(oficinaId: number, p: Periodo) {
    const linhas = await prisma.$queryRaw<
      Array<{ id: number; nome: string; qtd: bigint; faturamento: unknown; custo: unknown; abertas: bigint }>
    >`
      SELECT f.id, f.nome,
        COUNT(o.id) FILTER (WHERE o.status = 'concluida'
          AND COALESCE(o.data_fechamento, o.updated_at) >= ${p.inicio} AND COALESCE(o.data_fechamento, o.updated_at) < ${p.fim}) AS qtd,
        COALESCE(SUM(o.valor_total) FILTER (WHERE o.status = 'concluida'
          AND COALESCE(o.data_fechamento, o.updated_at) >= ${p.inicio} AND COALESCE(o.data_fechamento, o.updated_at) < ${p.fim}), 0) AS faturamento,
        COALESCE(SUM(custo.valor) FILTER (WHERE o.status = 'concluida'
          AND COALESCE(o.data_fechamento, o.updated_at) >= ${p.inicio} AND COALESCE(o.data_fechamento, o.updated_at) < ${p.fim}), 0) AS custo,
        COUNT(o.id) FILTER (WHERE o.status IN ('aberta', 'em_andamento')) AS abertas
      FROM funcionario f
      LEFT JOIN ordem_servico o ON o.funcionario_id = f.id AND o.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT SUM(i.quantidade * pc.preco_custo) AS valor
        FROM item_ordem_servico i JOIN peca pc ON pc.id = i.peca_id
        WHERE i.ordem_servico_id = o.id AND i.tipo_item = 'peca' AND i.deleted_at IS NULL
      ) custo ON TRUE
      WHERE f.oficina_id = ${oficinaId} AND f.deleted_at IS NULL
      GROUP BY f.id, f.nome
      ORDER BY faturamento DESC, f.nome
    `;

    const mecanicos = linhas
      .map((l) => {
        const faturamento = arred(num(l.faturamento));
        const custo = arred(num(l.custo));
        const qtd = Number(l.qtd);
        return {
          id: l.id,
          nome: l.nome,
          ordens_concluidas: qtd,
          ordens_abertas: Number(l.abertas),
          faturamento,
          ticket_medio: qtd ? arred(faturamento / qtd) : 0,
          custo_pecas: custo,
          margem: arred(faturamento - custo),
          margem_percentual: faturamento > 0 ? arred(((faturamento - custo) / faturamento) * 100) : 0,
        };
      })
      .filter((m) => m.ordens_concluidas > 0 || m.ordens_abertas > 0);

    const faturamento = arred(mecanicos.reduce((s, m) => s + m.faturamento, 0));
    const concluidas = mecanicos.reduce((s, m) => s + m.ordens_concluidas, 0);
    return {
      periodo: { de: p.inicioISO, ate: p.fimISO },
      totais: { ordens_concluidas: concluidas, faturamento, ticket_medio: concluidas ? arred(faturamento / concluidas) : 0 },
      mecanicos,
    };
  },

  /** Resultado do periodo em regime de caixa: o que entrou e saiu de fato (pelos movimentos, ja descontados os estornos). */
  async resultado(oficinaId: number, p: Periodo) {
    const soma = (ini: Date, fim: Date) => prisma.$queryRaw<Array<{ tipo: string; categoria: string | null; total: unknown }>>`
      SELECT p.tipo::text AS tipo, COALESCE(NULLIF(BTRIM(p.categoria), ''), 'Sem categoria') AS categoria,
             SUM(CASE WHEN m.tipo = 'pagamento' THEN m.valor ELSE -m.valor END) AS total
      FROM pagamento_movimento m JOIN pagamento p ON p.id = m.pagamento_id
      WHERE m.oficina_id = ${oficinaId} AND p.deleted_at IS NULL AND m.created_at >= ${ini} AND m.created_at < ${fim}
      GROUP BY 1, 2
    `;
    const [atual, anterior] = await Promise.all([soma(p.inicio, p.fim), soma(p.anterior.inicio, p.anterior.fim)]);

    const totais = (linhas: typeof atual) => {
      const receitas = arred(linhas.filter((l) => l.tipo === "receber").reduce((s, l) => s + num(l.total), 0));
      const despesas = arred(linhas.filter((l) => l.tipo === "pagar").reduce((s, l) => s + num(l.total), 0));
      return { receitas, despesas, resultado: arred(receitas - despesas) };
    };
    const agrupar = (tipo: string) =>
      atual
        .filter((l) => l.tipo === tipo && num(l.total) !== 0)
        .map((l) => ({ categoria: l.categoria ?? "Sem categoria", valor: arred(num(l.total)) }))
        .sort((a, b) => b.valor - a.valor);

    const t = totais(atual);
    const ant = totais(anterior);
    return {
      periodo: { de: p.inicioISO, ate: p.fimISO },
      ...t,
      margem_percentual: t.receitas > 0 ? arred((t.resultado / t.receitas) * 100) : 0,
      periodo_anterior: ant,
      variacao_resultado: variacao(t.resultado, ant.resultado),
      receitas_por_categoria: agrupar("receber"),
      despesas_por_categoria: agrupar("pagar"),
    };
  },
};
