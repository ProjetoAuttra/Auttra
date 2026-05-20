import { prisma } from "../prisma/client.js";

type OrcamentoItemInput = {
  tipo_item?: "servico" | "peca";
  tipo?: "servico" | "peca";
  servico_id?: number | null;
  peca_id?: number | null;
  nome?: string | null;
  quantidade?: number;
  preco_unitario?: number;
  preco?: number;
  subtotal?: number;
};

const orcamentoInclude = {
  cliente: true,
  veiculo: true,
  itens: { include: { servico: true, peca: true } },
} as const;

function mapItemOrcamento(item: OrcamentoItemInput) {
  const tipo = item.tipo_item ?? item.tipo ?? "servico";
  const quantidade = Number(item.quantidade ?? 1);
  const precoUnitario = Number(item.preco_unitario ?? item.preco ?? 0);

  return {
    tipo_item: tipo,
    servico_id: tipo === "servico" ? item.servico_id ?? null : null,
    peca_id: tipo === "peca" ? item.peca_id ?? null : null,
    nome: item.nome ?? null,
    quantidade,
    preco_unitario: precoUnitario,
    subtotal: Number(item.subtotal ?? quantidade * precoUnitario),
  };
}

export class OrcamentoService {
  async listarTodos(oficinaId: number) {
    return prisma.orcamento.findMany({
      where: { deleted_at: null, cliente: { oficina_id: oficinaId } },
      orderBy: { id: "desc" },
      include: orcamentoInclude,
    });
  }

  async buscarPorId(id: number, oficinaId: number) {
    return prisma.orcamento.findFirst({
      where: { id, deleted_at: null, cliente: { oficina_id: oficinaId } },
      include: orcamentoInclude,
    });
  }

  async validarItens(itens: OrcamentoItemInput[] | undefined, oficinaId: number) {
    for (const item of itens ?? []) {
      const tipo = item.tipo_item ?? item.tipo;
      if (tipo === "servico" && item.servico_id) {
        const servico = await prisma.servico.findFirst({
          where: { id: Number(item.servico_id), oficina_id: oficinaId, deleted_at: null },
        });
        if (!servico) throw new Error("Servico nao encontrado nesta oficina.");
      }
      if (tipo === "peca" && item.peca_id) {
        const peca = await prisma.peca.findFirst({
          where: { id: Number(item.peca_id), oficina_id: oficinaId, deleted_at: null },
        });
        if (!peca) throw new Error("Peca nao encontrada nesta oficina.");
      }
    }
  }

  async criar(data: {
    clienteId: number;
    veiculoId: number;
    descricao: string;
    valor: number;
    data: string;
    itens?: OrcamentoItemInput[];
	    oficinaId: number;
	  }) {
    const cliente = await prisma.cliente.findFirst({
      where: { id: data.clienteId, oficina_id: data.oficinaId, deleted_at: null },
    });
    if (!cliente) throw new Error("Cliente nao encontrado nesta oficina.");
    const veiculo = await prisma.veiculo.findFirst({
      where: { id: data.veiculoId, oficina_id: data.oficinaId, deleted_at: null },
    });
    if (!veiculo) throw new Error("Veiculo nao encontrado nesta oficina.");

    await this.validarItens(data.itens, data.oficinaId);
    const itens = (data.itens ?? []).map(mapItemOrcamento);
    const valor = itens.length
      ? itens.reduce((total, item) => total + Number(item.subtotal), 0)
      : Number(data.valor);

    return prisma.orcamento.create({
      data: {
        descricao: data.descricao,
        valor,
        data: new Date(data.data),
        cliente_id: data.clienteId,
        veiculo_id: data.veiculoId,
        itens: itens.length ? { create: itens } : undefined,
      },
      include: orcamentoInclude,
    });
  }
  

  async atualizarStatus(id: number, status: "analise" | "aprovado" | "recusado", oficinaId: number) {
    const existing = await this.buscarPorId(id, oficinaId);
    if (!existing) throw new Error("Orcamento nao encontrado nesta oficina.");
    return prisma.orcamento.update({
      where: { id },
      data: { status },
    });
  }

  async atualizar(id: number, data: any, oficinaId: number) {
    const existing = await this.buscarPorId(id, oficinaId);
    if (!existing) throw new Error("Orcamento nao encontrado nesta oficina.");
    const clienteId = data.cliente_id ?? data.clienteId;
    const veiculoId = data.veiculo_id ?? data.veiculoId;

    if (clienteId != null) {
      const cliente = await prisma.cliente.findFirst({
        where: { id: Number(clienteId), oficina_id: oficinaId, deleted_at: null },
      });
      if (!cliente) throw new Error("Cliente nao encontrado nesta oficina.");
    }
    if (veiculoId != null) {
      const veiculo = await prisma.veiculo.findFirst({
        where: { id: Number(veiculoId), oficina_id: oficinaId, deleted_at: null },
      });
      if (!veiculo) throw new Error("Veiculo nao encontrado nesta oficina.");
    }
    await this.validarItens(data.itens, oficinaId);
    const itens = Array.isArray(data.itens) ? data.itens.map(mapItemOrcamento) : undefined;
    const valor = itens
      ? itens.reduce((total: number, item: any) => total + Number(item.subtotal), 0)
      : data.valor != null
        ? Number(data.valor)
        : undefined;

    return prisma.$transaction(async (tx) => {
      await tx.orcamento.update({
        where: { id },
        data: {
          descricao: data.descricao,
          valor,
          data: data.data ? new Date(data.data) : undefined,
          cliente_id: clienteId != null ? Number(clienteId) : undefined,
          veiculo_id: veiculoId != null ? Number(veiculoId) : undefined,
        },
      });

      if (itens) {
        await tx.item_orcamento.deleteMany({ where: { orcamento_id: id } });
        if (itens.length) {
          await tx.item_orcamento.createMany({
            data: itens.map((item: any) => ({ ...item, orcamento_id: id })),
          });
        }
      }

      return tx.orcamento.findUnique({
        where: { id },
        include: orcamentoInclude,
      });
    });
  }

  async excluir(id: number, oficinaId: number) {
    const existing = await this.buscarPorId(id, oficinaId);
    if (!existing) throw new Error("Orcamento nao encontrado nesta oficina.");
    return prisma.orcamento.update({ where: { id }, data: { deleted_at: new Date(), status: "recusado" } });
  }
}
