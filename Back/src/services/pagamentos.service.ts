import { prisma } from "../prisma/client.js";

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
  async list(oficina_id: number, cliente_id?: number) {
    if (!oficina_id) throw new Error("oficina_id e obrigatorio.");
    const where: any = { oficina_id, deleted_at: null };
    if (cliente_id) where.cliente_id = cliente_id;
    return await prisma.pagamento.findMany({
      where,
      orderBy: { data_vencimento: "desc" },
      take: 200,
      include: {
        cliente: { select: { id: true, nome: true, email: true } },
        fornecedor: { select: { id: true, nome: true } },
        ordem_servico: { select: { id: true, status: true } },
      },
    });
  },

  async listByCliente(cliente_id: number, oficina_id: number) {
    if (!cliente_id) throw new Error("cliente_id e obrigatorio.");
    return await prisma.pagamento.findMany({
      where: { cliente_id, oficina_id, deleted_at: null },
      orderBy: { data_vencimento: "desc" },
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
        status:                   data.status ?? "pendente",
        data_vencimento:          new Date(data.data_vencimento),
        data_vencimento_original: new Date(data.data_vencimento),
        data_pagamento:           data.data_pagamento ? new Date(data.data_pagamento) : null,
        categoria:                data.categoria ?? null,
        descricao:                data.descricao ?? null,
        observacao:               data.observacao ?? null,
      },
    });
  },

  async update(id: number, data: Partial<PagamentoInput>, oficinaId: number) {
    if (!id) throw new Error("ID do pagamento e obrigatorio.");
    const existing = await prisma.pagamento.findFirst({
      where: { id, deleted_at: null, oficina_id: oficinaId },
    });
    if (!existing) throw new Error("Pagamento nao encontrado.");
    const merged = { ...existing, ...data };
    validatePagamento({
      oficina_id: oficinaId,
      valor: Number(merged.valor),
      tipo: merged.tipo,
      cliente_id: merged.cliente_id,
      ordem_servico_id: merged.ordem_servico_id,
    });
    await validatePagamentoRelations(merged, oficinaId);
    return await prisma.pagamento.update({
      where: { id },
      data: {
        ...data,
        oficina_id:       oficinaId,
        cliente_id:       data.cliente_id === undefined ? existing.cliente_id : data.cliente_id,
        fornecedor_id:    data.fornecedor_id === undefined ? existing.fornecedor_id : data.fornecedor_id,
        ordem_servico_id: data.ordem_servico_id === undefined ? existing.ordem_servico_id : data.ordem_servico_id,
        data_vencimento:  data.data_vencimento ? new Date(data.data_vencimento) : existing.data_vencimento,
        data_pagamento:   data.data_pagamento ? new Date(data.data_pagamento) : existing.data_pagamento,
      },
    });
  },

  async delete(id: number, oficinaId: number) {
    if (!id) throw new Error("ID do pagamento e obrigatorio.");
    const existing = await prisma.pagamento.findFirst({ where: { id, deleted_at: null, oficina_id: oficinaId } });
    if (!existing) throw new Error("Pagamento nao encontrado.");
    await prisma.pagamento.update({
      where: { id },
      data: { deleted_at: new Date(), status: "cancelado" },
    });
    return { message: "Pagamento cancelado com sucesso." };
  },

  async extrato(oficina_id: number, from?: string, to?: string) {
    if (!oficina_id) throw new Error("oficina_id e obrigatorio.");
    const where: any = { oficina_id, deleted_at: null };
    if (from && to) {
      where.data_vencimento = { gte: new Date(from), lte: new Date(to) };
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

  // ── Ações financeiras ────────────────────────────────────────────────────────

  async pagar(id: number, data: { metodo: string; data_pagamento?: string }, oficinaId: number) {
    const existing = await prisma.pagamento.findFirst({
      where: { id, oficina_id: oficinaId, deleted_at: null },
    });
    if (!existing) throw new Error("Pagamento não encontrado.");
    const valorLiquido = Number(existing.valor_original) - Number(existing.desconto);
    return prisma.pagamento.update({
      where: { id },
      data: {
        status:         "pago",
        valor_pago:     valorLiquido,
        metodo:         data.metodo as any,
        data_pagamento: data.data_pagamento ? new Date(data.data_pagamento) : new Date(),
      },
    });
  },

  async aplicarDesconto(id: number, data: { desconto: number; motivo_desconto: string }, oficinaId: number) {
    const existing = await prisma.pagamento.findFirst({
      where: { id, oficina_id: oficinaId, deleted_at: null },
    });
    if (!existing) throw new Error("Pagamento não encontrado.");
    if (existing.status === "pago" || existing.status === "cancelado")
      throw new Error("Não é possível aplicar desconto em pagamentos pagos ou cancelados.");
    if (data.desconto > Number(existing.valor_original))
      throw new Error("Desconto não pode ser maior que o valor original.");
    if (!data.motivo_desconto?.trim())
      throw new Error("Motivo do desconto é obrigatório.");
    return prisma.pagamento.update({
      where: { id },
      data: { desconto: data.desconto, motivo_desconto: data.motivo_desconto },
    });
  },

  async renegociar(id: number, data: { nova_data_vencimento: string }, oficinaId: number) {
    const existing = await prisma.pagamento.findFirst({
      where: { id, oficina_id: oficinaId, deleted_at: null },
    });
    if (!existing) throw new Error("Pagamento não encontrado.");
    if (existing.status === "pago" || existing.status === "cancelado")
      throw new Error("Não é possível renegociar pagamentos pagos ou cancelados.");
    return prisma.pagamento.update({
      where: { id },
      data: {
        data_vencimento:   new Date(data.nova_data_vencimento),
        vezes_renegociado: { increment: 1 },
      },
    });
  },

  async pagamentoParcial(id: number, data: { valor_entrada: number; metodo: string }, oficinaId: number) {
    const existing = await prisma.pagamento.findFirst({
      where: { id, oficina_id: oficinaId, deleted_at: null },
    });
    if (!existing) throw new Error("Pagamento não encontrado.");
    if (existing.status === "pago" || existing.status === "cancelado")
      throw new Error("Não é possível registrar entrada em pagamentos pagos ou cancelados.");
    if (data.valor_entrada <= 0)
      throw new Error("Valor de entrada deve ser maior que zero.");
    const novoValorPago = Number(existing.valor_pago) + data.valor_entrada;
    const valorLiquido  = Number(existing.valor_original) - Number(existing.desconto);
    const novoStatus    = novoValorPago >= valorLiquido ? "pago" : "parcial";
    return prisma.pagamento.update({
      where: { id },
      data: {
        valor_pago:     novoValorPago,
        status:         novoStatus as any,
        metodo:         data.metodo as any,
        data_pagamento: novoStatus === "pago" ? new Date() : existing.data_pagamento,
      },
    });
  },

  async parcelar(
    id: number,
    data: { total_parcelas: number; data_primeira_parcela: string; metodo?: string },
    oficinaId: number,
  ) {
    const existing = await prisma.pagamento.findFirst({
      where: { id, oficina_id: oficinaId, deleted_at: null },
    });
    if (!existing) throw new Error("Pagamento não encontrado.");
    if (existing.status !== "pendente")
      throw new Error("Só é possível parcelar pagamentos pendentes.");
    if (data.total_parcelas < 2)
      throw new Error("Total de parcelas deve ser no mínimo 2.");
    const valorLiquido = Number(existing.valor_original) - Number(existing.desconto);
    const valorParcela = valorLiquido / data.total_parcelas;
    const dataPrimeira = new Date(data.data_primeira_parcela);
    return prisma.$transaction(async (tx: any) => {
      await tx.pagamento.update({
        where: { id },
        data: { status: "cancelado", deleted_at: new Date() },
      });
      const parcelas = [];
      for (let i = 0; i < data.total_parcelas; i++) {
        const dataVencimento = new Date(dataPrimeira);
        dataVencimento.setMonth(dataVencimento.getMonth() + i);
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
              ? `${existing.descricao} (${i + 1}/${data.total_parcelas})`
              : `Parcela ${i + 1}/${data.total_parcelas}`,
            observacao:               existing.observacao,
            pagamento_pai_id:         id,
            parcela_numero:           i + 1,
            total_parcelas:           data.total_parcelas,
          },
        }));
      }
      return { cancelado: id, parcelas };
    });
  },
};
