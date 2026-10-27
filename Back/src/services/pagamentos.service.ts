import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";
import { HttpError } from "../utils/httpError.js";
import { LIMITE_LISTAGEM } from "../utils/limites.js";
import { listarPaginado, type Paginacao } from "../utils/paginacao.js";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

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
    },
  });
}

/** Mesmas relacoes da listagem: o front substitui a linha pela resposta da acao e precisa de cliente/fornecedor/OS. */
const relacoes = {
  cliente: { select: { id: true, nome: true, email: true } },
  fornecedor: { select: { id: true, nome: true } },
  ordem_servico: { select: { id: true, status: true } },
} as const;

const valorLiquido = (p: { valor_original: Prisma.Decimal.Value; desconto: Prisma.Decimal.Value }) =>
  D(p.valor_original).minus(D(p.desconto));

type PagamentoInput = {
  cliente_id?: number | null;
  oficina_id: number;
  ordem_servico_id?: number | null;
  fornecedor_id?: number | null;
  tipo: "pagar" | "receber";
  metodo?: "dinheiro" | "pix" | "cartao" | "boleto" | "transferencia";
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

export const PagamentosService = {
  async list(
    oficina_id: number,
    filtros: { cliente_id?: number; tipo?: string; status?: string; search?: string } = {},
    pag: Paginacao | null = null
  ) {
    if (!oficina_id) throw new Error("oficina_id e obrigatorio.");
    const where: any = { oficina_id, deleted_at: null };
    if (filtros.cliente_id) where.cliente_id = filtros.cliente_id;
    if (filtros.tipo) where.tipo = filtros.tipo;
    if (filtros.status) where.status = filtros.status;
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
            orderBy: [{ data_vencimento: "desc" }, { id: "desc" }],
            skip,
            take,
            include: {
              cliente: { select: { id: true, nome: true, email: true } },
              fornecedor: { select: { id: true, nome: true } },
              ordem_servico: { select: { id: true, status: true } },
            },
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
        COALESCE(SUM(CASE WHEN status IN ('pendente','parcial') THEN valor_original - desconto - valor_pago END), 0) AS total_aberto,
        COALESCE(SUM(CASE WHEN status = 'pago' AND data_pagamento >= ${inicioMes} THEN valor_original - desconto END), 0) AS pago_mes,
        COALESCE(SUM(CASE WHEN status IN ('pendente','parcial') AND data_vencimento < ${hoje} THEN valor_original - desconto - valor_pago END), 0) AS vencidos,
        COALESCE(SUM(CASE WHEN status IN ('pendente','parcial') AND data_vencimento >= ${hoje} AND data_vencimento <= ${fimMes} THEN valor_original - desconto - valor_pago END), 0) AS a_vencer,
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
      include: { cliente: true, oficina: true, fornecedor: true, ordem_servico: true },
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
      if (data.data_vencimento !== undefined) patch.data_vencimento = toDate(data.data_vencimento, "data_vencimento");

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

  async extrato(oficina_id: number, from?: string, to?: string) {
    if (!oficina_id) throw new Error("oficina_id e obrigatorio.");
    const where: any = { oficina_id, deleted_at: null };
    if (from || to) {
      where.data_vencimento = {
        ...(from ? { gte: toDate(from, "from") } : {}),
        ...(to ? { lte: toDate(to, "to") } : {}),
      };
    }
    const pagamentos = await prisma.pagamento.findMany({
      where,
      orderBy: { data_vencimento: "desc" },
    });
    const totalRecebido = pagamentos
      .filter((p) => p.tipo === "receber" && p.status === "pago")
      .reduce((sum, p) => sum + Number(p.valor), 0);
    const totalPagar = pagamentos
      .filter((p) => p.tipo === "pagar" && p.status !== "pago")
      .reduce((sum, p) => sum + Number(p.valor), 0);
    return { totalRecebido, totalPagar, saldo: totalRecebido - totalPagar, pagamentos };
  },

  // ── Ações financeiras (cada uma roda em transacao com a linha travada) ─────────

  /**
   * Baixa do titulo. Sem `valor`, quita o saldo restante. Com `valor`: menor que o saldo = recebimento
   * parcial (status "parcial"); igual = quita; maior = erro.
   */
  async pagar(
    id: number,
    data: { metodo: string; valor?: number | string | null; data_pagamento?: string },
    oficinaId: number,
    usuarioId?: number | null
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await lockPagamento(tx, id, oficinaId);
      if (existing.status === "pago") throw new Error("Este pagamento já foi registrado como pago.");
      if (existing.status === "cancelado") throw new Error("Não é possível pagar um título cancelado.");

      const liquido = valorLiquido(existing);
      const restante = liquido.minus(D(existing.valor_pago));
      const informouValor = data.valor !== undefined && data.valor !== null && data.valor !== "";
      const entrada = informouValor ? toPositiveDecimal(data.valor, "Valor") : restante;
      if (entrada.greaterThan(restante)) {
        throw new Error(`Valor excede o saldo restante (${restante.toFixed(2)}).`);
      }

      const quitado = D(existing.valor_pago).plus(entrada).greaterThanOrEqualTo(liquido);
      const atualizado = await tx.pagamento.update({
        where: { id },
        data: {
          status:         quitado ? "pago" : "parcial",
          valor_pago:     D(existing.valor_pago).plus(entrada),
          metodo:         data.metodo as any,
          data_pagamento: quitado
            ? (data.data_pagamento ? toDate(data.data_pagamento, "data_pagamento") : new Date())
            : existing.data_pagamento,
        },
        include: relacoes,
      });
      if (entrada.greaterThan(0)) {
        await registrarMovimento(tx, existing, { tipo: "pagamento", valor: entrada, metodo: data.metodo, usuarioId });
      }
      return atualizado;
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
      if (D(existing.valor_original).minus(desconto).lessThan(D(existing.valor_pago)))
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

  async pagamentoParcial(id: number, data: { valor_entrada: number; metodo: string }, oficinaId: number, usuarioId?: number | null) {
    const entrada = toPositiveDecimal(data.valor_entrada, "Valor de entrada");
    return prisma.$transaction(async (tx) => {
      const existing = await lockPagamento(tx, id, oficinaId);
      if (existing.status === "pago" || existing.status === "cancelado")
        throw new Error("Não é possível registrar entrada em pagamentos pagos ou cancelados.");
      const liquido = valorLiquido(existing);
      const novoValorPago = D(existing.valor_pago).plus(entrada);
      if (novoValorPago.greaterThan(liquido))
        throw new Error(`Valor excede o saldo restante (${liquido.minus(D(existing.valor_pago)).toFixed(2)}).`);
      const quitado = novoValorPago.greaterThanOrEqualTo(liquido);
      const atualizado = await tx.pagamento.update({
        where: { id },
        data: {
          valor_pago:     novoValorPago,
          status:         quitado ? "pago" : "parcial",
          metodo:         data.metodo as any,
          data_pagamento: quitado ? new Date() : existing.data_pagamento,
        },
        include: relacoes,
      });
      await registrarMovimento(tx, existing, { tipo: "pagamento", valor: entrada, metodo: data.metodo, usuarioId });
      return atualizado;
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

      for (const mov of ativos) {
        await registrarMovimento(tx, existing, {
          tipo: "estorno", valor: D(mov.valor), metodo: mov.metodo, usuarioId, motivo, estornoDeId: mov.id,
        });
      }
      if (residual.greaterThan(0)) {
        await registrarMovimento(tx, existing, { tipo: "estorno", valor: residual, metodo: existing.metodo, usuarioId, motivo });
      }

      return tx.pagamento.update({
        where: { id },
        data: { status: "pendente", valor_pago: 0, data_pagamento: null },
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
      include: { usuario: { select: { id: true, nome: true } } },
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
