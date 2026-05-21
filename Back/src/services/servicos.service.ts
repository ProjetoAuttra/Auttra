import { prisma } from "../prisma/client.js";

export const ServicosService = {
  list: (oficinaId: number, search: string = "") => {
    const where: any = { deleted_at: null, oficina_id: oficinaId };
    if (search.trim().length > 0) {
      where.nome = { contains: search.trim(), mode: "insensitive" };
    }
    return prisma.servico.findMany({
      where,
      ...(search.trim().length > 0 ? { take: 20 } : {}),
    });
  },

  getById: (id: number, oficinaId: number) =>
    prisma.servico.findFirst({
      where: { id, deleted_at: null, oficina_id: oficinaId },
    }),

  create: async (data: any) => {
    const existing = await prisma.servico.findFirst({
      where: { nome: data.nome, oficina_id: data.oficina_id },
    });

    if (existing) {
      const reativado = await prisma.servico.update({
        where: { id: existing.id },
        data: {
          nome: data.nome,
          descricao: data.descricao ?? null,
          preco: data.preco,
          categoria: data.categoria ?? null,
          tempo_estimado: data.tempo_estimado ? Number(data.tempo_estimado) : null,
          ativo: data.ativo !== false,
          deleted_at: null,
        },
      });
      return { ...reativado, _reativado: true };
    }

    const novo = await prisma.servico.create({
      data: {
        oficina_id: data.oficina_id,
        nome: data.nome,
        descricao: data.descricao ?? null,
        preco: data.preco,
        categoria: data.categoria ?? null,
        tempo_estimado: data.tempo_estimado ? Number(data.tempo_estimado) : null,
        ativo: data.ativo !== false,
      },
    });
    return { ...novo, _reativado: false };
  },

  update: async (id: number, data: any, oficinaId: number) => {
    const existing = await prisma.servico.findFirst({ where: { id, oficina_id: oficinaId, deleted_at: null } });
    if (!existing) throw new Error("Servico nao encontrado nesta oficina.");

    return prisma.servico.update({
      where: { id },
      data: {
        nome: data.nome,
        descricao: data.descricao ?? null,
        preco: data.preco,
        categoria: data.categoria ?? null,
        tempo_estimado: data.tempo_estimado ? Number(data.tempo_estimado) : null,
        ativo: data.ativo !== false,
      },
    });
  },

  remove: async (id: number, oficinaId: number) => {
    const existing = await prisma.servico.findFirst({ where: { id, oficina_id: oficinaId, deleted_at: null } });
    if (!existing) throw new Error("Servico nao encontrado nesta oficina.");

    return prisma.servico.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  },
};
