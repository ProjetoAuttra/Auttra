import { prisma } from "../prisma/client.js";

export const PecasService = {
  list: async (oficinaId: number, search: string = "") => {
    const where: any = { deleted_at: null, oficina_id: oficinaId };
    if (search.trim().length > 0) {
      where.nome = { contains: search.trim(), mode: "insensitive" };
    }
    return prisma.peca.findMany({
      where,
      orderBy: { id: "desc" },
      ...(search.trim().length > 0 ? { take: 20 } : {}),
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
      const reativado = await prisma.peca.update({
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
      return { ...reativado, _reativado: true };
    }

    const nova = await prisma.peca.create({ data });
    return { ...nova, _reativado: false };
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
