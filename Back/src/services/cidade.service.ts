import { prisma } from "../prisma/client.js";

export const CidadeService = {
  async create(data: { nome: string; uf: string }) {
    const { nome, uf } = data;

    if (!nome || !uf) throw new Error("Nome e UF são obrigatórios.");

    const existing = await prisma.cidade.findFirst({
      where: { nome: { equals: nome, mode: "insensitive" }, uf: uf.toUpperCase() },
    });
    if (existing) return existing;

    const cidade = await prisma.cidade.create({
      data: {
        nome,
        uf: uf.toUpperCase(),
      },
    });

    return cidade;
  },

  async list() {
    return prisma.cidade.findMany({
      orderBy: { nome: "asc" },
    });
  },

  async getById(id: number) {
    const cidade = await prisma.cidade.findUnique({ where: { id } });
    if (!cidade) throw new Error("Cidade não encontrada.");
    return cidade;
  },
};
