import { prisma } from "../prisma/client.js";

export const PecasService = {
  list: async (oficinaId: number) => {
    return prisma.peca.findMany({
      where: { deleted_at: null, oficina_id: oficinaId },
      orderBy: { id: "desc" },
    });
  },

  getById: async (id: number, oficinaId: number) => {
    return prisma.peca.findFirst({
      where: { id, deleted_at: null, oficina_id: oficinaId },
    });
  },

  create: async (data: any) => {
    const existing = await prisma.peca.findFirst({
      where: { nome: data.nome, oficina_id: data.oficina_id },
    });

    if (existing) {
      return prisma.peca.update({
        where: { id: existing.id },
        data: {
          nome: data.nome,
          descricao: data.descricao ?? null,
          preco_custo: data.preco_custo,
          preco_venda: data.preco_venda,
          estoque: data.estoque ?? existing.estoque,
          deleted_at: null,
        },
      });
    }

    return prisma.peca.create({ data });
  },

  update: async (id: number, data: any, oficinaId: number) => {
    const existing = await prisma.peca.findFirst({ where: { id, oficina_id: oficinaId, deleted_at: null } });
    if (!existing) throw new Error("Peca nao encontrada nesta oficina.");
    const { oficina_id, oficinaId: _oficinaId, ...patch } = data;

    return prisma.peca.update({
      where: { id },
      data: patch,
    });
  },

  delete: async (id: number, oficinaId: number) => {
    const existing = await prisma.peca.findFirst({ where: { id, oficina_id: oficinaId, deleted_at: null } });
    if (!existing) throw new Error("Peca nao encontrada nesta oficina.");

    return prisma.peca.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  },

  ajuste: async (id: number, tipo: "entrada" | "saida", quantidade: number, oficinaId: number) => {
    const peca = await prisma.peca.findFirst({ where: { id, oficina_id: oficinaId, deleted_at: null } });
    if (!peca) throw new Error("Peca nao encontrada.");
    if (quantidade <= 0) throw new Error("A quantidade deve ser maior que zero.");
    if (tipo === "saida" && peca.estoque < quantidade) {
      throw new Error(`Estoque insuficiente. Disponivel: ${peca.estoque}`);
    }
    return prisma.peca.update({
      where: { id },
      data: { estoque: tipo === "entrada" ? { increment: quantidade } : { decrement: quantidade } },
    });
  },
};
