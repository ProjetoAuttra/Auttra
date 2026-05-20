import { prisma } from "../prisma/client.js";

function normalizePlaca(placa: string) {
  return placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const VeiculosService = {
  list: (filters: { oficina_id: number; cliente_id?: number }) => {
    const where: any = { deleted_at: null, oficina_id: filters.oficina_id };
    if (filters?.cliente_id) where.cliente_id = filters.cliente_id;

    return prisma.veiculo.findMany({
      where,
      include: { cliente: true, oficina: true },
      orderBy: { id: "desc" },
    });
  },

  getById: (id: number, oficinaId: number) =>
    prisma.veiculo.findFirst({
      where: { id, deleted_at: null, oficina_id: oficinaId },
      include: {
        cliente: true,
        ordens: {
          where: { deleted_at: null },
          orderBy: { data_abertura: "desc" },
          include: { funcionario: true },
        },
      },
    }),

  create: async (data: any) => {
    const clienteId = Number(data.cliente_id ?? data.clienteId);
    const oficinaId = Number(data.oficina_id ?? data.oficinaId);
    const placa = normalizePlaca(String(data.placa ?? ""));

    if (!clienteId || !oficinaId || !placa || !data.marca || !data.modelo) {
      throw new Error("cliente_id, oficina_id, placa, marca e modelo sao obrigatorios.");
    }

    const cliente = await prisma.cliente.findFirst({
      where: { id: clienteId, oficina_id: oficinaId, deleted_at: null },
    });
    if (!cliente) throw new Error("Cliente nao encontrado nesta oficina.");

    const existing = await prisma.veiculo.findFirst({
      where: { placa, oficina_id: oficinaId },
    });

    if (existing) {
      return prisma.veiculo.update({
        where: { id: existing.id },
        data: {
          cliente_id: clienteId,
          marca: data.marca,
          modelo: data.modelo,
          ano: data.ano ? Number(data.ano) : null,
          cor: data.cor ?? null,
          combustivel: data.combustivel ?? null,
          quilometragem: data.quilometragem ? Number(data.quilometragem) : null,
          observacao: data.observacao ?? null,
          deleted_at: null,
        },
      });
    }

    return prisma.veiculo.create({
      data: {
        cliente_id: clienteId,
        oficina_id: oficinaId,
        placa,
        marca: data.marca,
        modelo: data.modelo,
        ano: data.ano ? Number(data.ano) : null,
        cor: data.cor ?? null,
        combustivel: data.combustivel ?? null,
        quilometragem: data.quilometragem ? Number(data.quilometragem) : null,
        observacao: data.observacao ?? null,
      },
    });
  },

  update: async (id: number, data: any, oficinaId: number) => {
    const patch: any = { ...data };
    delete patch.clienteId;
    delete patch.oficinaId;

    if (data.placa != null) patch.placa = normalizePlaca(String(data.placa));
    if (data.cliente_id) patch.cliente_id = Number(data.cliente_id);
    delete patch.oficina_id;
    if (data.ano != null) patch.ano = Number(data.ano);
    if (data.quilometragem != null) patch.quilometragem = Number(data.quilometragem);

    const existing = await prisma.veiculo.findFirst({ where: { id, oficina_id: oficinaId, deleted_at: null } });
    if (!existing) throw new Error("Veiculo nao encontrado nesta oficina.");
    patch.oficina_id = oficinaId;

    if (patch.cliente_id) {
      const cli = await prisma.cliente.findFirst({
        where: { id: patch.cliente_id, oficina_id: oficinaId, deleted_at: null },
      });
      if (!cli) throw new Error("Cliente nao encontrado nesta oficina.");
    }

    return prisma.veiculo.update({ where: { id }, data: patch });
  },

  remove: async (id: number, oficinaId: number) => {
    const existing = await prisma.veiculo.findFirst({ where: { id, oficina_id: oficinaId, deleted_at: null } });
    if (!existing) throw new Error("Veiculo nao encontrado nesta oficina.");

    return prisma.veiculo.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  },
};
