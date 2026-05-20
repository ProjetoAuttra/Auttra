import { prisma } from "../prisma/client.js";

export const OficinaService = {
  async create(data: {
    nome: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    cep: string;
    cidade_id: number;
    telefone?: string;
    email?: string;
    cnpj?: string;
  }) {
    const { nome, logradouro, numero, cep, cidade_id, complemento, telefone, email, cnpj } = data;

    if (!nome || !logradouro || !numero || !cep || !cidade_id)
      throw new Error("Campos obrigatorios ausentes para criacao da oficina.");

    const byNome = await prisma.oficina.findFirst({ where: { nome, deleted_at: null } });
    if (byNome) throw new Error("Ja existe uma oficina com este nome.");

    if (cnpj) {
      const byCnpj = await prisma.oficina.findFirst({ where: { cnpj, deleted_at: null } });
      if (byCnpj) throw new Error("Ja existe uma oficina com este CNPJ.");
    }

    if (email) {
      const byEmail = await prisma.oficina.findFirst({ where: { email, deleted_at: null } });
      if (byEmail) throw new Error("Ja existe uma oficina com este e-mail.");
    }

    return prisma.oficina.create({
      data: { nome, logradouro, numero, complemento, cep, cidade_id, telefone, email, cnpj },
    });
  },

  async list(oficinaId: number) {
    return prisma.oficina.findMany({
      where: { id: oficinaId, deleted_at: null },
      include: {
        acessos: {
          where: { deleted_at: null },
          include: { usuario: { select: { id: true, nome: true, email: true, tipo: true } } },
        },
      },
    });
  },
};
