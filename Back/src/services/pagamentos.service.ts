import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma/client.js";
import { HttpError } from "../utils/httpError.js";
import { LIMITE_LISTAGEM } from "../utils/limites.js";
import { listarPaginado, type Paginacao } from "../utils/paginacao.js";
import { dataIso, listaCsv } from "../utils/filtros.js";
import { aceitaMetodo, calcularTaxa, ehMetodoCartao } from "./maquininhas.service.js";
import { FUSO_OFICINA, hojeISO } from "../utils/datas.js";

/** Valor aceito pelo construtor do Decimal (o Prisma 7 nao exporta mais Decimal.Value). */
type DecimalValue = Prisma.Decimal | number | string;

const D = (v: DecimalValue) => new Prisma.Decimal(v);

function toPositiveDecimal(value: unknown, field: string) {
  const n = typeof value === "string" ? Number(value) : (value as number);
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) throw new Error(`${field} deve ser um numero maior que zero.`);
  return D(n).toDecimalPlaces(2);
}

function toDate(value: unknown, field: string) {
  const d = new Date(value as any);
  if (!value || Number.isNaN(d.getTime())) throw new Error(`${field} invalida.`);
  return d;
}

/** Soma meses mantendo o dia, limitado ao ultimo dia do mes (31/jan + 1 mes = 28/fev). */
function addMonths(base: Date, months: number) {
  const d = new Date(base);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

/** Trava a linha (SELECT ... FOR UPDATE) para que acoes concorrentes sobre o mesmo titulo sejam serializadas. */
async function lockPagamento(tx: Prisma.TransactionClient, id: number, oficinaId: number) {
  await tx.$queryRaw`SELECT id FROM pagamento WHERE id = ${id} AND oficina_id = ${oficinaId} AND deleted_at IS NULL FOR UPDATE`;
  const pagamento = await tx.pagamento.findFirst({ where: { id, oficina_id: oficinaId, deleted_at: null } });
  if (!pagamento) throw new Error("Pagamento não encontrado.");
  return pagamento;
}

async function registrarMovimento(
  tx: Prisma.TransactionClient,
  pagamento: { id: number; oficina_id: number },
  dados: {
    tipo: "pagamento" | "estorno";
    valor: Prisma.Decimal;
    metodo?: string | null;
    usuarioId?: number | null;
    motivo?: string | null;
    estornoDeId?: number | null;
    taxa?: TaxaCartao | null;
  }
) {
  return tx.pagamento_movimento.create({
    data: {
      pagamento_id: pagamento.id,
      oficina_id: pagamento.oficina_id,
      tipo: dados.tipo,
      valor: dados.valor,
      metodo: (dados.metodo ?? null) as any,
      usuario_id: dados.usuarioId ?? null,
      motivo: dados.motivo ?? null,
      estorno_de_id: dados.estornoDeId ?? null,
      ...(dados.taxa
        ? {
            maquininha_id: dados.taxa.maquininha_id,
            cartao_parcelas: dados.taxa.cartao_parcelas,
            taxa_percentual: dados.taxa.taxa_percentual,
            valor_taxa: dados.taxa.valor_taxa,
            data_prevista_recebimento: dados.taxa.data_prevista_recebimento,
          }
        : {}),
    },
  });
}

/** Maquininha, parcelas e taxa de um recebimento no cartão, como gravados no título e no movimento. */
type TaxaCartao = {
  maquininha_id: number | null;
  cartao_parcelas: number | null;
  taxa_percentual: Prisma.Decimal | null;
  valor_taxa: Prisma.Decimal;
  data_prevista_recebimento: Date | null;
  /** Só no recebimento: as parcelas que vão cair, gravadas como recebíveis. */
  cronograma?: ReturnType<typeof calcularTaxa>["cronograma"];
};

/** O que o usuário escolheu ao receber no cartão. */
export type DadosCartao = { maquininha_id?: number | string | null; cartao_parcelas?: number | string | null };

/**
 * Taxa do recebimento. Só existe em conta a receber paga no crédito ou no débito. Havendo maquininha ativa
 * que aceite o método, escolher uma é obrigatório (é o que garante o valor líquido certo). Sem nenhuma,
 * o recebimento segue sem taxa, como antes.
 */
async function taxaDoRecebimento(
  tx: Prisma.TransactionClient,
  titulo: { tipo: string; oficina_id: number },
  metodo: string,
  entrada: Prisma.Decimal,
  dataPagamento: Date,
  cartao: DadosCartao
): Promise<TaxaCartao | null> {
  const idInformado = cartao.maquininha_id !== undefined && cartao.maquininha_id !== null && cartao.maquininha_id !== "";
  if (titulo.tipo !== "receber" || !ehMetodoCartao(metodo)) {
    if (idInformado) throw new HttpError("Maquininha só se aplica a recebimentos no crédito ou no débito.", 400);
    return null;
  }
  if (!idInformado) {
    const filtroMetodo = metodo === "cartao_debito" ? { aceita_debito: true } : { aceita_credito: true };
    const temMaquininha = await tx.maquininha.count({ where: { oficina_id: titulo.oficina_id, deleted_at: null, ativo: true, ...filtroMetodo } });
    if (temMaquininha) throw new HttpError("Escolha a maquininha usada no recebimento.", 400);
    return null;
  }
  const maquininha = await tx.maquininha.findFirst({
    where: { id: Number(cartao.maquininha_id), oficina_id: titulo.oficina_id, deleted_at: null },
  });
  if (!maquininha) throw new HttpError("Maquininha não encontrada.", 404);
  if (!maquininha.ativo) throw new HttpError("Esta maquininha está inativa.", 400);
  if (!aceitaMetodo(maquininha, metodo))
    throw new HttpError(`Esta maquininha não aceita ${metodo === "cartao_debito" ? "débito" : "crédito"}.`, 400);
  const parcelas = metodo === "cartao_debito" ? 1 : Number(cartao.cartao_parcelas ?? 1);
  return { maquininha_id: maquininha.id, ...calcularTaxa(maquininha, metodo, parcelas, entrada, dataPagamento) };
}

/** Mesmas relacoes da listagem: o front substitui a linha pela resposta da acao e precisa de cliente/fornecedor/OS. */
const relacoes = {
  cliente: { select: { id: true, nome: true, email: true } },
  fornecedor: { select: { id: true, nome: true } },
  ordem_servico: { select: { id: true, status: true } },
  maquininha: { select: { id: true, nome: true, operadora: true } },
} as const;

/** Valor do título: original - desconto + multa. */
const valorLiquido = (p: { valor_original: DecimalValue; desconto: DecimalValue; multa: DecimalValue }) =>
  D(p.valor_original).minus(D(p.desconto)).plus(D(p.multa));

/** Lê um valor monetário opcional (desconto/multa): vazio = não informado; inválido ou negativo = erro. */
function valorOpcional(bruto: unknown, nome: string) {
  if (bruto === undefined || bruto === null || bruto === "") return null;
  const n = Number(bruto);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${nome} invalida.`);
  return D(n);
}

type PagamentoInput = {
  cliente_id?: number | null;
  oficina_id: number;
  ordem_servico_id?: number | null;
  fornecedor_id?: number | null;
  tipo: "pagar" | "receber";
  metodo?: "dinheiro" | "pix" | "cartao" | "cartao_credito" | "cartao_debito" | "boleto" | "transferencia";
  valor: number;
  status?: "pendente" | "parcial" | "pago" | "cancelado";
  data_vencimento: Date | string;
  data_pagamento?: Date | string | null;
  categoria?: string | null;
  descricao?: string | null;
  observacao?: string | null;
};

function validatePagamento(data: Partial<PagamentoInput>) {
  if (!data.oficina_id || !data.valor || !data.tipo) {
    throw new Error("oficina_id, valor e tipo sao obrigatorios.");
  }
  if (data.tipo === "receber" && !data.cliente_id && !data.ordem_servico_id) {
    throw new Error("Contas a receber precisam de cliente_id ou ordem_servico_id.");
  }
}

async function validatePagamentoRelations(data: any, oficinaId: number) {
  if (data.cliente_id) {
    const cliente = await prisma.cliente.findFirst({
      where: { id: Number(data.cliente_id), oficina_id: oficinaId, deleted_at: null },
    });
    if (!cliente) throw new Error("Cliente nao encontrado nesta oficina.");
  }
  if (data.fornecedor_id) {
    const fornecedor = await prisma.fornecedor.findFirst({
      where: { id: Number(data.fornecedor_id), oficina_id: oficinaId, deleted_at: null },
    });
    if (!fornecedor) throw new Error("Fornecedor nao encontrado nesta oficina.");
  }
  if (data.ordem_servico_id) {
    const ordem = await prisma.ordem_servico.findFirst({
      where: { id: Number(data.ordem_servico_id), oficina_id: oficinaId, deleted_at: null },
    });
    if (!ordem) throw new Error("Ordem de servico nao encontrada nesta oficina.");
  }
}

/** Marca na descricao que o titulo nasceu do saldo de um recebimento/pagamento parcial (sem empilhar a marca). */
export function descricaoDoSaldo(descricao: string | null | undefined, tipo: "pagar" | "receber") {
  const marca = tipo === "receber" ? "saldo do recebimento parcial" : "saldo do pagamento parcial";
  const base = (descricao ?? "").replace(/\s*\(saldo d[oe] (recebimento|pagamento) parcial\)\s*$/i, "").trim();
  return base ? `${base} (${marca})` : `Saldo do ${tipo === "receber" ? "recebimento" : "pagamento"} parcial`;
}

/**
 * Registra um recebimento/pagamento de `entrada` no titulo (ja travado).
 * - Quitando o saldo, o titulo fica "pago".
 * - Pagando menos que o saldo, o titulo vira "pago" pelo valor recebido e o que falta nasce como um
 *   novo titulo pendente, com o mesmo vencimento: nao existe mais titulo "parcial".
 */
async function registrarEntrada(
  tx: Prisma.TransactionClient,
  existing: Awaited<ReturnType<typeof lockPagamento>>,
  entrada: Prisma.Decimal,
  metodo: string,
  dataPagamento: Date,
  usuarioId?: number | null,
  cartao: DadosCartao = {}
) {
  const restante = valorLiquido(existing).minus(D(existing.valor_pago));
  const taxa = entrada.greaterThan(0) ? await taxaDoRecebimento(tx, existing, metodo, entrada, dataPagamento, cartao) : null;
  const totalPago = D(existing.valor_pago).plus(entrada);
  const quitado = entrada.greaterThanOrEqualTo(restante);

  // Parcial: o titulo passa a valer exatamente o que foi pago (o desconto ja dado fica nele e a multa vai
  // para o titulo de saldo, ja embutida no valor dele).
  const novoOriginal = quitado ? undefined : totalPago.plus(D(existing.desconto));

  const atualizado = await tx.pagamento.update({
    where: { id: existing.id },
    data: {
      status: "pago",
      valor_pago: totalPago,
      metodo: metodo as any,
      data_pagamento: dataPagamento,
      ...(novoOriginal ? { valor_original: novoOriginal, valor: novoOriginal, multa: 0 } : {}),
      // A taxa soma com a de uma entrada anterior (titulo "parcial" antigo); a maquininha e o prazo ficam os da ultima.
      ...(taxa
        ? {
            maquininha_id: taxa.maquininha_id,
            cartao_parcelas: taxa.cartao_parcelas,
            taxa_percentual: taxa.taxa_percentual,
            valor_taxa: D(existing.valor_taxa).plus(taxa.valor_taxa),
            data_prevista_recebimento: taxa.data_prevista_recebimento,
          }
        : {}),
    },
    include: relacoes,
  });
  // Desconto de 100% quita o titulo sem entrada de dinheiro: nao ha movimento de valor zero.
  if (entrada.greaterThan(0)) {
    const movimento = await registrarMovimento(tx, existing, { tipo: "pagamento", valor: entrada, metodo, usuarioId, taxa });
    if (taxa?.cronograma?.length) {
      await tx.recebivel.createMany({
        data: taxa.cronograma.map((c) => ({
          ...c,
          oficina_id: existing.oficina_id,
          pagamento_id: existing.id,
          movimento_id: movimento.id,
          maquininha_id: taxa.maquininha_id,
        })),
      });
    }
  }

  if (quitado) return atualizado;

  const saldo = restante.minus(entrada);
  const tituloSaldo = await tx.pagamento.create({
    data: {
      cliente_id: existing.cliente_id,
      oficina_id: existing.oficina_id,
      ordem_servico_id: existing.ordem_servico_id,
      fornecedor_id: existing.fornecedor_id,
      tipo: existing.tipo,
      metodo: existing.metodo,
      valor: saldo,
      valor_original: saldo,
      status: "pendente",
      data_vencimento: existing.data_vencimento,
      data_vencimento_original: existing.data_vencimento_original,
      vezes_renegociado: existing.vezes_renegociado,
      categoria: existing.categoria,
      descricao: descricaoDoSaldo(existing.descricao, existing.tipo),
      observacao: `Saldo do título #${existing.id}`,
      pagamento_pai_id: existing.id,
    },
    include: relacoes,
  });
  return { ...atualizado, titulo_saldo: tituloSaldo };
}

/**
 * Janela de data_pagamento para um período de dias (YYYY-MM-DD) no fuso do usuário: data_pagamento
 * guarda um instante, então o dia inteiro vai de 00:00 do início a 00:00 do dia seguinte ao fim.
 */
function janelaPagamento(filtros: { pagamento_de?: string; pagamento_ate?: string; tz_offset?: string }) {
  const deslocamento = (Number(filtros.tz_offset) || 0) * 60_000;
  const pagDe = dataIso(filtros.pagamento_de);
  const pagAte = dataIso(filtros.pagamento_ate);
  if (!pagDe && !pagAte) return null;
  return {
    ...(pagDe ? { gte: new Date(pagDe.getTime() + deslocamento) } : {}),
    ...(pagAte ? { lt: new Date(pagAte.getTime() + 86_400_000 + deslocamento) } : {}),
  };
}

/**
 * Linhas do extrato por efetivação: quando e quanto o dinheiro cai de fato na conta.
 * - Recebimento no cartão com maquininha: uma linha por recebível (parcela), líquida, na data prevista.
 * - O resto (pix, dinheiro, pagamentos, cartão sem maquininha): o título pago, no dia do pagamento.
 * `de`/`ate` são dias (YYYY-MM-DD) no fuso da oficina, inclusive.
 */
function sqlEfetivacao(oficinaId: number, f: { de?: string; ate?: string; tipo?: string; metodo?: string; maquininha?: string }) {
  const de = dataIso(f.de);
  const ate = dataIso(f.ate);
  const tipo = f.tipo === "receber" || f.tipo === "pagar" ? f.tipo : null;
  const periodo = Prisma.sql`${de ? Prisma.sql`AND l.data >= ${f.de}::date` : Prisma.empty} ${ate ? Prisma.sql`AND l.data <= ${f.ate}::date` : Prisma.empty}`;
  const filtroTipo = tipo ? Prisma.sql`AND l.tipo = ${tipo}` : Prisma.empty;
  // Listas separadas por vírgula, como em GET /pagamentos.
  const metodos = listaCsv(f.metodo).filter((m) => METODOS.includes(m));
  const filtroMetodo = metodos.length ? Prisma.sql`AND l.metodo IN (${Prisma.join(metodos)})` : Prisma.empty;
  const maquininhas = listaCsv(f.maquininha).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const filtroMaquininha = maquininhas.length ? Prisma.sql`AND l.maquininha_id IN (${Prisma.join(maquininhas)})` : Prisma.empty;
  return Prisma.sql`
    SELECT * FROM (
      SELECT 'p' || p.id AS chave, p.id AS pagamento_id, p.tipo::text AS tipo,
             -- Data escolhida num campo de data chega como meia-noite UTC: é o próprio dia. Outros instantes, no fuso da oficina.
             CASE WHEN (p.data_pagamento AT TIME ZONE 'UTC')::time = '00:00'
                  THEN (p.data_pagamento AT TIME ZONE 'UTC')::date
                  ELSE (p.data_pagamento AT TIME ZONE ${FUSO_OFICINA})::date END AS data,
             p.valor_pago AS valor, p.valor_pago AS valor_bruto, 0::numeric AS valor_taxa,
             p.descricao, p.categoria, p.metodo::text AS metodo, p.cartao_parcelas,
             NULL::int AS parcela, NULL::int AS total_parcelas, NULL::text AS maquininha, p.maquininha_id,
             c.nome AS cliente, f.nome AS fornecedor
      FROM pagamento p
      LEFT JOIN cliente c ON c.id = p.cliente_id
      LEFT JOIN fornecedor f ON f.id = p.fornecedor_id
      WHERE p.oficina_id = ${oficinaId} AND p.deleted_at IS NULL AND p.status = 'pago' AND p.data_pagamento IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM recebivel r WHERE r.pagamento_id = p.id)
      UNION ALL
      SELECT 'r' || r.id, p.id, p.tipo::text, r.data_prevista,
             r.valor_liquido, r.valor_bruto, r.valor_taxa,
             p.descricao, p.categoria, p.metodo::text, p.cartao_parcelas,
             r.parcela, r.total_parcelas, q.nome, r.maquininha_id,
             c.nome, f.nome
      FROM recebivel r
      JOIN pagamento p ON p.id = r.pagamento_id
      LEFT JOIN maquininha q ON q.id = r.maquininha_id
      LEFT JOIN cliente c ON c.id = p.cliente_id
      LEFT JOIN fornecedor f ON f.id = p.fornecedor_id
      WHERE r.oficina_id = ${oficinaId} AND p.deleted_at IS NULL AND p.status = 'pago'
    ) l
    WHERE TRUE ${periodo} ${filtroTipo} ${filtroMetodo} ${filtroMaquininha}
  `;
}

type LinhaEfetivacao = {
  chave: string; pagamento_id: number; tipo: string; data: Date;
  valor: Prisma.Decimal; valor_bruto: Prisma.Decimal; valor_taxa: Prisma.Decimal;
  descricao: string | null; categoria: string | null; metodo: string | null; cartao_parcelas: number | null;
  parcela: number | null; total_parcelas: number | null; maquininha: string | null; maquininha_id: number | null;
  cliente: string | null; fornecedor: string | null;
};

const METODOS = ["dinheiro", "pix", "cartao", "cartao_credito", "cartao_debito", "boleto", "transferencia"];

export const PagamentosService = {
  async list(
    oficina_id: number,
    filtros: {
      cliente_id?: number;
      fornecedor_id?: number;
      tipo?: string;
      /** Lista separada por vírgula: pendente, pago, cancelado e/ou "vencido" (em aberto com vencimento anterior a `hoje`). */
      status?: string;
      /** Lista separada por vírgula. */
      metodo?: string;
      /** Ids de maquininha separados por vírgula. */
      maquininha?: string;
      vencimento_de?: string;
      vencimento_ate?: string;
      /** Período em que o título foi pago/recebido (data_pagamento); exclui os ainda em aberto. */
      pagamento_de?: string;
      pagamento_ate?: string;
      /** Minutos de diferença entre UTC e o fuso do usuário (Date.getTimezoneOffset), para os limites do dia de pagamento. */
      tz_offset?: string;
      hoje?: string;
      search?: string;
      /** "pagamento": mais recentes pela data do pagamento (extrato); padrão: pelo vencimento. */
      ordem?: string;
    } = {},
    pag: Paginacao | null = null
  ) {
    if (!oficina_id) throw new Error("oficina_id e obrigatorio.");
    const where: any = { oficina_id, deleted_at: null };
    if (filtros.cliente_id) where.cliente_id = filtros.cliente_id;
    if (filtros.tipo) where.tipo = filtros.tipo;
    if (filtros.fornecedor_id) where.fornecedor_id = filtros.fornecedor_id;
    const metodos = listaCsv(filtros.metodo).filter((m) => METODOS.includes(m));
    if (metodos.length) where.metodo = { in: metodos };
    const maquininhas = listaCsv(filtros.maquininha).map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (maquininhas.length) where.maquininha_id = { in: maquininhas };

    const and: any[] = [];
    // Vários status se combinam com OU; "vencido" é um pendente/parcial com vencimento anterior a `hoje`.
    const statuses = listaCsv(filtros.status);
    if (statuses.length) {
      const hoje = dataIso(filtros.hoje) ?? new Date();
      const ou: any[] = statuses.filter((st) => st !== "vencido").map((st) => ({ status: st }));
      if (statuses.includes("vencido")) ou.push({ status: { in: ["pendente", "parcial"] }, data_vencimento: { lt: hoje } });
      and.push({ OR: ou });
    }
    const de = dataIso(filtros.vencimento_de);
    const ate = dataIso(filtros.vencimento_ate);
    if (de || ate) and.push({ data_vencimento: { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) } });
    const janela = janelaPagamento(filtros);
    if (janela) and.push({ data_pagamento: janela });
    if (and.length) where.AND = and;
    if (filtros.search) {
      const contains = { contains: filtros.search, mode: "insensitive" };
      where.OR = [
        { descricao: contains },
        { categoria: contains },
        { cliente: { nome: contains } },
        { fornecedor: { nome: contains } },
      ];
    }
    return listarPaginado(
      pag,
      {
        find: ({ skip, take }) =>
          prisma.pagamento.findMany({
            where,
            orderBy:
              filtros.ordem === "pagamento"
                ? [{ data_pagamento: "desc" }, { id: "desc" }]
                : [{ data_vencimento: "desc" }, { id: "desc" }],
            skip,
            take,
            include: relacoes,
          }),
        count: () => prisma.pagamento.count({ where }),
      },
      200
    );
  },

  /** Totais dos cards de Contas a Receber/Pagar, calculados no banco sobre todos os títulos (não só a página). */
  async resumo(oficina_id: number, tipo: "receber" | "pagar", hojeIso?: string) {
    if (!oficina_id) throw new Error("oficina_id e obrigatorio.");
    const base = hojeIso && /^\d{4}-\d{2}-\d{2}$/.test(hojeIso) ? new Date(`${hojeIso}T00:00:00.000Z`) : new Date();
    const hoje = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
    const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
    const fimMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0));

    const [r] = await prisma.$queryRaw<
      Array<{
        total_aberto: Prisma.Decimal;
        pago_mes: Prisma.Decimal;
        vencidos: Prisma.Decimal;
        a_vencer: Prisma.Decimal;
        qtd_total: bigint;
        qtd_vencidos: bigint;
        qtd_pendentes: bigint;
      }>
    >`
      SELECT
        COALESCE(SUM(CASE WHEN status IN ('pendente','parcial') THEN valor_original - desconto + multa - valor_pago END), 0) AS total_aberto,
        COALESCE(SUM(CASE WHEN status = 'pago' AND data_pagamento >= ${inicioMes} THEN valor_original - desconto + multa END), 0) AS pago_mes,
        COALESCE(SUM(CASE WHEN status IN ('pendente','parcial') AND data_vencimento < ${hoje} THEN valor_original - desconto + multa - valor_pago END), 0) AS vencidos,
        COALESCE(SUM(CASE WHEN status IN ('pendente','parcial') AND data_vencimento >= ${hoje} AND data_vencimento <= ${fimMes} THEN valor_original - desconto + multa - valor_pago END), 0) AS a_vencer,
        COUNT(*) AS qtd_total,
        COUNT(*) FILTER (WHERE status IN ('pendente','parcial') AND data_vencimento < ${hoje}) AS qtd_vencidos,
        COUNT(*) FILTER (WHERE status = 'pendente') AS qtd_pendentes
      FROM pagamento
      WHERE oficina_id = ${oficina_id} AND deleted_at IS NULL AND tipo = ${tipo}::tipo_pagamento
    `;

    return {
      total_aberto: Number(r.total_aberto),
      pago_mes: Number(r.pago_mes),
      vencidos: Number(r.vencidos),
      a_vencer: Number(r.a_vencer),
      qtd_total: Number(r.qtd_total),
      qtd_vencidos: Number(r.qtd_vencidos),
      qtd_pendentes: Number(r.qtd_pendentes),
    };
  },

  async listByCliente(cliente_id: number, oficina_id: number) {
    if (!cliente_id) throw new Error("cliente_id e obrigatorio.");
    return await prisma.pagamento.findMany({
      where: { cliente_id, oficina_id, deleted_at: null },
      orderBy: { data_vencimento: "desc" },
      take: LIMITE_LISTAGEM,
      include: {
        oficina: { select: { id: true, nome: true } },
        fornecedor: { select: { id: true, nome: true } },
      },
    });
  },

  async getById(id: number, oficinaId: number) {
    if (!id) throw new Error("ID do pagamento e obrigatorio.");
    const pagamento = await prisma.pagamento.findFirst({
      where: { id, deleted_at: null, oficina_id: oficinaId },
      include: { cliente: true, oficina: true, fornecedor: true, ordem_servico: true, maquininha: { select: { id: true, nome: true, operadora: true } } },
    });
    if (!pagamento) throw new Error("Pagamento nao encontrado.");
    return pagamento;
  },

  async create(data: PagamentoInput) {
    validatePagamento(data);
    toPositiveDecimal(data.valor, "valor");
    toDate(data.data_vencimento, "data_vencimento");
    await validatePagamentoRelations(data, data.oficina_id);
    return await prisma.pagamento.create({
      data: {
        cliente_id:               data.cliente_id ?? null,
        oficina_id:               data.oficina_id,
        ordem_servico_id:         data.ordem_servico_id ?? null,
        fornecedor_id:            data.fornecedor_id ?? null,
        tipo:                     data.tipo,
        metodo:                   data.metodo ?? null,
        valor:                    data.valor,
        valor_original:           data.valor,
        desconto:                 0,
        valor_pago:               0,
        // titulos nascem pendentes; baixa so pelas acoes /pagar e /pagamento-parcial
        status:                   "pendente",
        data_vencimento:          new Date(data.data_vencimento),
        data_vencimento_original: new Date(data.data_vencimento),
        data_pagamento:           null,
        categoria:                data.categoria ?? null,
        descricao:                data.descricao ?? null,
        observacao:               data.observacao ?? null,
      },
      include: relacoes,
    });
  },

  async update(id: number, data: Partial<PagamentoInput>, oficinaId: number) {
    if (!id) throw new Error("ID do pagamento e obrigatorio.");
    return prisma.$transaction(async (tx) => {
      const existing = await lockPagamento(tx, id, oficinaId);

      // Whitelist: status, valor_pago, desconto, deleted_at etc. so mudam pelas acoes financeiras.
      const patch: Prisma.pagamentoUncheckedUpdateInput = {};
      for (const key of ["categoria", "descricao", "observacao"] as const) {
        if (data[key] !== undefined) patch[key] = data[key];
      }
      if (data.metodo !== undefined) patch.metodo = data.metodo;
      if (data.cliente_id !== undefined) patch.cliente_id = data.cliente_id;
      if (data.fornecedor_id !== undefined) patch.fornecedor_id = data.fornecedor_id;
      if (data.ordem_servico_id !== undefined) patch.ordem_servico_id = data.ordem_servico_id;
      if (data.data_vencimento !== undefined) {
        const nova = toDate(data.data_vencimento, "data_vencimento");
        // Mudar o vencimento eh renegociar o prazo: conta a renegociacao e preserva a data original.
        if (nova.toISOString().slice(0, 10) !== existing.data_vencimento.toISOString().slice(0, 10)) {
          if (existing.status === "pago" || existing.status === "cancelado")
            throw new Error("Não é possível alterar o vencimento de títulos pagos ou cancelados.");
          patch.data_vencimento = nova;
          patch.vezes_renegociado = { increment: 1 };
          if (!existing.data_vencimento_original) patch.data_vencimento_original = existing.data_vencimento;
        }
      }

      if (data.valor !== undefined) {
        if (existing.status !== "pendente" || !D(existing.valor_pago).isZero()) {
          throw new Error("So eh possivel alterar o valor de titulos pendentes sem pagamento registrado.");
        }
        const valor = toPositiveDecimal(data.valor, "valor");
        if (D(existing.desconto).greaterThan(valor)) throw new Error("O desconto aplicado eh maior que o novo valor.");
        patch.valor = valor;
        patch.valor_original = valor; // pagar/parcelar calculam a partir de valor_original
      }

      const merged = { ...existing, ...patch } as any;
      validatePagamento({
        oficina_id: oficinaId,
        valor: Number(merged.valor),
        tipo: merged.tipo,
        cliente_id: merged.cliente_id,
        ordem_servico_id: merged.ordem_servico_id,
      });
      await validatePagamentoRelations(merged, oficinaId);

      return tx.pagamento.update({ where: { id }, data: patch, include: relacoes });
    });
  },

  async delete(id: number, oficinaId: number) {
    if (!id) throw new Error("ID do pagamento e obrigatorio.");
    return prisma.$transaction(async (tx) => {
      const existing = await lockPagamento(tx, id, oficinaId);
      // titulo com dinheiro ja registrado nao some: primeiro precisa ser estornado
      if (existing.status === "pago" || existing.status === "parcial" || !D(existing.valor_pago).isZero()) {
        throw new HttpError(
          "Este título já possui pagamento registrado e não pode ser excluído. Estorne o pagamento antes de excluir.",
          409,
          "PAGAMENTO_REQUER_ESTORNO"
        );
      }
      await tx.pagamento.update({
        where: { id },
        data: { deleted_at: new Date(), status: "cancelado" },
      });
      return { message: "Pagamento cancelado com sucesso." };
    });
  },

  /**
   * Totais do extrato: o dinheiro que de fato entrou e saiu no período, isto é, os títulos pagos
   * (somando valor_pago) pela data do pagamento. Mesmo critério de data de GET /pagamentos com
   * status=pago&pagamento_de&pagamento_ate, que traz as linhas. Recebimento parcial já vira um
   * título pago próprio, e estorno tira o título de "pago", então nada fica de fora ou duplicado.
   */
  async extratoResumo(oficina_id: number, filtros: { pagamento_de?: string; pagamento_ate?: string; tz_offset?: string } = {}) {
    if (!oficina_id) throw new Error("oficina_id e obrigatorio.");
    const where: Prisma.pagamentoWhereInput = { oficina_id, deleted_at: null, status: "pago" };
    const janela = janelaPagamento(filtros);
    if (janela) where.data_pagamento = janela;

    const grupos = await prisma.pagamento.groupBy({
      by: ["tipo"],
      where,
      _sum: { valor_pago: true, valor_taxa: true },
      _count: { _all: true },
    });
    const soma = (tipo: string) => D(grupos.find((g) => g.tipo === tipo)?._sum.valor_pago ?? 0);
    const qtd = (tipo: string) => grupos.find((g) => g.tipo === tipo)?._count._all ?? 0;
    const entradas = soma("receber");
    const saidas = soma("pagar");
    const taxas = D(grupos.find((g) => g.tipo === "receber")?._sum.valor_taxa ?? 0);
    return {
      entradas: Number(entradas),
      taxas_cartao: Number(taxas),
      entradas_liquidas: Number(entradas.minus(taxas)),
      saidas: Number(saidas),
      saldo: Number(entradas.minus(saidas)),
      qtd_entradas: qtd("receber"),
      qtd_saidas: qtd("pagar"),
    };
  },

  /** Extrato por efetivação, paginado: mais recentes primeiro. */
  async extratoEfetivacao(
    oficina_id: number,
    filtros: { de?: string; ate?: string; tipo?: string; metodo?: string; maquininha?: string } = {},
    pag: Paginacao | null = null
  ) {
    if (!oficina_id) throw new Error("oficina_id e obrigatorio.");
    const base = sqlEfetivacao(oficina_id, filtros);
    const limite = pag ? Prisma.sql`LIMIT ${pag.limit} OFFSET ${pag.skip}` : Prisma.sql`LIMIT 200`;
    const [linhas, [contagem]] = await Promise.all([
      prisma.$queryRaw<LinhaEfetivacao[]>`SELECT * FROM (${base}) x ORDER BY x.data DESC, x.chave DESC ${limite}`,
      prisma.$queryRaw<Array<{ total: bigint }>>`SELECT COUNT(*) AS total FROM (${base}) x`,
    ]);
    const rows = linhas.map((l) => ({
      ...l,
      data: l.data.toISOString().slice(0, 10),
      valor: Number(l.valor),
      valor_bruto: Number(l.valor_bruto),
      valor_taxa: Number(l.valor_taxa),
    }));
    return { rows, total: pag ? Number(contagem.total) : rows.length };
  },

  /** Totais do extrato por efetivação no período (entradas já líquidas das taxas). */
  async extratoEfetivacaoResumo(oficina_id: number, filtros: { de?: string; ate?: string } = {}) {
    if (!oficina_id) throw new Error("oficina_id e obrigatorio.");
    const base = sqlEfetivacao(oficina_id, filtros);
    const grupos = await prisma.$queryRaw<Array<{ tipo: string; total: Prisma.Decimal; taxas: Prisma.Decimal; qtd: bigint }>>`
      SELECT x.tipo, SUM(x.valor) AS total, SUM(x.valor_taxa) AS taxas, COUNT(*) AS qtd FROM (${base}) x GROUP BY x.tipo
    `;
    const de = (tipo: string) => grupos.find((g) => g.tipo === tipo);
    const entradas = D(de("receber")?.total ?? 0);
    const saidas = D(de("pagar")?.total ?? 0);
    return {
      entradas: Number(entradas),
      saidas: Number(saidas),
      saldo: Number(entradas.minus(saidas)),
      taxas_cartao: Number(de("receber")?.taxas ?? 0),
      qtd_entradas: Number(de("receber")?.qtd ?? 0),
      qtd_saidas: Number(de("pagar")?.qtd ?? 0),
    };
  },

  /** O que ainda vai cair das maquininhas (recebíveis depois de hoje), com a próxima data. */
  async aCair(oficina_id: number) {
    const hoje = hojeISO();
    const [r] = await prisma.$queryRaw<Array<{ total: Prisma.Decimal | null; qtd: bigint; proxima: Date | null; ultima: Date | null }>>`
      SELECT SUM(r.valor_liquido) AS total, COUNT(*) AS qtd, MIN(r.data_prevista) AS proxima, MAX(r.data_prevista) AS ultima
      FROM recebivel r JOIN pagamento p ON p.id = r.pagamento_id
      WHERE r.oficina_id = ${oficina_id} AND p.deleted_at IS NULL AND p.status = 'pago' AND r.data_prevista > ${hoje}::date
    `;
    return {
      total: Number(r?.total ?? 0),
      qtd: Number(r?.qtd ?? 0),
      proxima: r?.proxima ? r.proxima.toISOString().slice(0, 10) : null,
      ultima: r?.ultima ? r.ultima.toISOString().slice(0, 10) : null,
    };
  },

  // ── Ações financeiras (cada uma roda em transacao com a linha travada) ─────────

  /**
   * Baixa do titulo. Sem `valor`, quita o saldo restante. Com `valor`: menor que o saldo = recebimento
   * parcial (status "parcial"); igual = quita; maior = erro.
   */
  async pagar(
    id: number,
    data: {
      metodo: string;
      valor?: number | string | null;
      data_pagamento?: string;
      /** Desconto do titulo (substitui o atual), aplicado na mesma transacao antes de calcular o saldo. */
      desconto?: number | string | null;
      motivo_desconto?: string | null;
      /** Multa do titulo (substitui a atual). */
      multa?: number | string | null;
    } & DadosCartao,
    oficinaId: number,
    usuarioId?: number | null
  ) {
    return prisma.$transaction(async (tx) => {
      let existing = await lockPagamento(tx, id, oficinaId);
      if (existing.status === "pago") throw new Error("Este pagamento já foi registrado como pago.");
      if (existing.status === "cancelado") throw new Error("Não é possível pagar um título cancelado.");

      // Desconto e multa (cada um substitui o atual) entram na mesma transacao, antes de calcular o saldo.
      const desconto = valorOpcional(data.desconto, "Desconto");
      const multa = valorOpcional(data.multa, "Multa");
      if (desconto || multa) {
        const novoDesconto = desconto ?? D(existing.desconto);
        const novaMulta = multa ?? D(existing.multa);
        if (novoDesconto.greaterThan(D(existing.valor_original))) throw new Error("Desconto não pode ser maior que o valor original.");
        if (D(existing.valor_original).minus(novoDesconto).plus(novaMulta).lessThan(D(existing.valor_pago)))
          throw new Error("O desconto deixaria o valor abaixo do que ja foi pago.");
        const motivo = String(data.motivo_desconto ?? "").trim();
        if (desconto?.greaterThan(0) && !motivo) throw new Error("Motivo do desconto é obrigatório.");
        existing = await tx.pagamento.update({
          where: { id },
          data: {
            ...(desconto ? { desconto, motivo_desconto: desconto.greaterThan(0) ? motivo : null } : {}),
            ...(multa ? { multa } : {}),
          },
        });
      }

      const liquido = valorLiquido(existing);
      const restante = liquido.minus(D(existing.valor_pago));
      const informouValor = data.valor !== undefined && data.valor !== null && data.valor !== "";
      const entrada = informouValor ? toPositiveDecimal(data.valor, "Valor") : restante;
      if (entrada.greaterThan(restante)) {
        throw new Error(`Valor excede o saldo restante (${restante.toFixed(2)}).`);
      }

      return registrarEntrada(
        tx,
        existing,
        entrada,
        data.metodo,
        data.data_pagamento ? toDate(data.data_pagamento, "data_pagamento") : new Date(),
        usuarioId,
        data
      );
    });
  },

  async aplicarDesconto(id: number, data: { desconto: number; motivo_desconto: string }, oficinaId: number) {
    return prisma.$transaction(async (tx) => {
      const existing = await lockPagamento(tx, id, oficinaId);
      if (existing.status === "pago" || existing.status === "cancelado")
        throw new Error("Não é possível aplicar desconto em pagamentos pagos ou cancelados.");
      const desconto = D(Number(data.desconto));
      if (!Number.isFinite(Number(data.desconto)) || desconto.isNegative())
        throw new Error("Desconto invalido.");
      if (desconto.greaterThan(D(existing.valor_original)))
        throw new Error("Desconto não pode ser maior que o valor original.");
      if (D(existing.valor_original).minus(desconto).plus(D(existing.multa)).lessThan(D(existing.valor_pago)))
        throw new Error("Desconto deixaria o valor abaixo do que ja foi pago.");
      if (!data.motivo_desconto?.trim())
        throw new Error("Motivo do desconto é obrigatório.");
      return tx.pagamento.update({
        where: { id },
        data: { desconto, motivo_desconto: data.motivo_desconto },
        include: relacoes,
      });
    });
  },

  async aplicarMulta(id: number, data: { multa: number }, oficinaId: number) {
    return prisma.$transaction(async (tx) => {
      const existing = await lockPagamento(tx, id, oficinaId);
      if (existing.status === "pago" || existing.status === "cancelado")
        throw new Error("Não é possível aplicar multa em pagamentos pagos ou cancelados.");
      const multa = valorOpcional(data.multa, "Multa");
      if (!multa) throw new Error("Multa invalida.");
      return tx.pagamento.update({ where: { id }, data: { multa }, include: relacoes });
    });
  },

  async renegociar(id: number, data: { nova_data_vencimento: string }, oficinaId: number) {
    const novaData = toDate(data.nova_data_vencimento, "nova_data_vencimento");
    return prisma.$transaction(async (tx) => {
      const existing = await lockPagamento(tx, id, oficinaId);
      if (existing.status === "pago" || existing.status === "cancelado")
        throw new Error("Não é possível renegociar pagamentos pagos ou cancelados.");
      return tx.pagamento.update({
        where: { id },
        data: {
          data_vencimento:   novaData,
          vezes_renegociado: { increment: 1 },
        },
        include: relacoes,
      });
    });
  },

  async pagamentoParcial(id: number, data: { valor_entrada: number; metodo: string } & DadosCartao, oficinaId: number, usuarioId?: number | null) {
    const entrada = toPositiveDecimal(data.valor_entrada, "Valor de entrada");
    return prisma.$transaction(async (tx) => {
      const existing = await lockPagamento(tx, id, oficinaId);
      if (existing.status === "pago" || existing.status === "cancelado")
        throw new Error("Não é possível registrar entrada em pagamentos pagos ou cancelados.");
      const restante = valorLiquido(existing).minus(D(existing.valor_pago));
      if (entrada.greaterThan(restante))
        throw new Error(`Valor excede o saldo restante (${restante.toFixed(2)}).`);
      return registrarEntrada(tx, existing, entrada, data.metodo, new Date(), usuarioId, data);
    });
  },

  /**
   * Estorna tudo o que foi pago no titulo: grava um movimento "estorno" para cada entrada ativa
   * (preservando o historico) e devolve o titulo para pendente. Cada parcela eh um titulo independente.
   */
  async estornar(id: number, data: { motivo?: string }, oficinaId: number, usuarioId?: number | null) {
    const motivo = String(data?.motivo ?? "").trim();
    if (!motivo) throw new Error("Motivo do estorno é obrigatório.");

    return prisma.$transaction(async (tx) => {
      const existing = await lockPagamento(tx, id, oficinaId);
      if (existing.status === "cancelado") throw new Error("Não é possível estornar um título cancelado.");

      const movimentos = await tx.pagamento_movimento.findMany({
        where: { pagamento_id: id },
        orderBy: { id: "asc" },
      });
      const jaEstornados = new Set(movimentos.filter((m) => m.tipo === "estorno" && m.estorno_de_id).map((m) => m.estorno_de_id));
      const ativos = movimentos.filter((m) => m.tipo === "pagamento" && !jaEstornados.has(m.id));

      const somaAtivos = ativos.reduce((acc, m) => acc.plus(D(m.valor)), D(0));
      const residual = D(existing.valor_pago).minus(somaAtivos); // so se houver valor_pago sem movimento correspondente
      if (D(existing.valor_pago).isZero()) {
        throw new HttpError("Este título não possui pagamento para estornar.", 409, "NADA_A_ESTORNAR");
      }

      // O que ia cair na conta por esses recebimentos deixa de existir.
      if (ativos.length) await tx.recebivel.deleteMany({ where: { movimento_id: { in: ativos.map((m) => m.id) } } });

      for (const mov of ativos) {
        await registrarMovimento(tx, existing, {
          tipo: "estorno", valor: D(mov.valor), metodo: mov.metodo, usuarioId, motivo, estornoDeId: mov.id,
          // O estorno devolve a taxa junto: somando pagamentos menos estornos, a taxa do periodo fecha.
          taxa: mov.maquininha_id || D(mov.valor_taxa).greaterThan(0)
            ? {
                maquininha_id: mov.maquininha_id,
                cartao_parcelas: mov.cartao_parcelas,
                taxa_percentual: mov.taxa_percentual,
                valor_taxa: D(mov.valor_taxa),
                data_prevista_recebimento: mov.data_prevista_recebimento,
              }
            : null,
        });
      }
      if (residual.greaterThan(0)) {
        await registrarMovimento(tx, existing, { tipo: "estorno", valor: residual, metodo: existing.metodo, usuarioId, motivo });
      }

      return tx.pagamento.update({
        where: { id },
        data: {
          status: "pendente", valor_pago: 0, data_pagamento: null,
          maquininha_id: null, cartao_parcelas: null, taxa_percentual: null, valor_taxa: 0, data_prevista_recebimento: null,
        },
        include: relacoes,
      });
    });
  },

  async listarMovimentos(id: number, oficinaId: number) {
    // inclui titulos ja cancelados: o historico continua consultavel
    const pagamento = await prisma.pagamento.findFirst({ where: { id, oficina_id: oficinaId }, select: { id: true } });
    if (!pagamento) throw new Error("Pagamento não encontrado.");
    return prisma.pagamento_movimento.findMany({
      where: { pagamento_id: id, oficina_id: oficinaId },
      orderBy: { id: "asc" },
      include: { usuario: { select: { id: true, nome: true } }, maquininha: { select: { id: true, nome: true } } },
    });
  },

  async parcelar(
    id: number,
    data: { total_parcelas: number; data_primeira_parcela: string; metodo?: string },
    oficinaId: number,
  ) {
    const total = Number(data.total_parcelas);
    if (!Number.isInteger(total) || total < 2) throw new Error("Total de parcelas deve ser no mínimo 2.");
    if (total > 120) throw new Error("Total de parcelas deve ser no máximo 120.");
    const dataPrimeira = toDate(data.data_primeira_parcela, "data_primeira_parcela");

    return prisma.$transaction(async (tx) => {
      const existing = await lockPagamento(tx, id, oficinaId);
      if (existing.status !== "pendente")
        throw new Error("Só é possível parcelar pagamentos pendentes.");

      // Divide em centavos; o resto vai para a ultima parcela para a soma fechar exatamente.
      const centavos = valorLiquido(existing).times(100).toDecimalPlaces(0).toNumber();
      const base = Math.floor(centavos / total);
      const resto = centavos - base * total;

      await tx.pagamento.update({
        where: { id },
        data: { status: "cancelado", deleted_at: new Date() },
      });
      const parcelas = [];
      for (let i = 0; i < total; i++) {
        const valorParcela = D(i === total - 1 ? base + resto : base).div(100);
        const dataVencimento = addMonths(dataPrimeira, i);
        parcelas.push(await tx.pagamento.create({
          data: {
            oficina_id:               existing.oficina_id,
            cliente_id:               existing.cliente_id,
            fornecedor_id:            existing.fornecedor_id,
            ordem_servico_id:         existing.ordem_servico_id,
            tipo:                     existing.tipo,
            metodo:                   (data.metodo ?? existing.metodo) as any ?? null,
            valor:                    valorParcela,
            valor_original:           valorParcela,
            desconto:                 0,
            valor_pago:               0,
            status:                   "pendente",
            data_vencimento:          dataVencimento,
            data_vencimento_original: dataVencimento,
            categoria:                existing.categoria,
            descricao:                existing.descricao
              ? `${existing.descricao} (${i + 1}/${total})`
              : `Parcela ${i + 1}/${total}`,
            observacao:               existing.observacao,
            pagamento_pai_id:         id,
            parcela_numero:           i + 1,
            total_parcelas:           total,
          },
          include: relacoes,
        }));
      }
      return { cancelado: id, parcelas };
    });
  },
};
