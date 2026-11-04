import { prisma } from "../prisma/client.js";
import { LIMITE_LISTAGEM } from "../utils/limites.js";

const CAMPOS_TEXTO = ["contato", "telefone", "email", "logradouro", "numero", "complemento", "cep"] as const;
type CampoTexto = (typeof CAMPOS_TEXTO)[number];

/**
 * Campos que a edicao do fornecedor pode alterar, montados um a um. Repassar o body deixava passar
 * relacoes como oficina/compras/pagamentos com connect, que moviam registros entre oficinas.
 */
function camposEditaveisFornecedor(data: any) {
  const patch: { nome?: string; cidade_id?: number | null } & Partial<Record<CampoTexto, string | null>> = {};
  if (!data || typeof data !== "object") return patch;

  if (data.nome !== undefined) {
    const nome = String(data.nome ?? "").trim();
    if (!nome) throw new Error("O nome do fornecedor é obrigatório.");
    patch.nome = nome;
  }
  for (const campo of CAMPOS_TEXTO) {
    if (data[campo] === undefined) continue;
    patch[campo] = data[campo] === null || data[campo] === "" ? null : String(data[campo]).trim();
  }
  if (data.cidade_id !== undefined) {
    if (data.cidade_id === null || data.cidade_id === "") {
      patch.cidade_id = null;
    } else {
      const cidadeId = Number(data.cidade_id);
      if (!Number.isInteger(cidadeId) || cidadeId <= 0) throw new Error("Campo cidade_id inválido.");
      patch.cidade_id = cidadeId;
    }
  }
  return patch;
}

export const FornecedoresService = {
  list: (oficinaId: number) =>
    prisma.fornecedor.findMany({
      where: { deleted_at: null, oficina_id: oficinaId },
      include: { cidade: true },
      orderBy: { nome: "asc" },
      take: LIMITE_LISTAGEM,
    }),

  getById: (id: number, oficinaId: number) =>
    prisma.fornecedor.findFirst({
      where: { id, deleted_at: null, oficina_id: oficinaId },
      include: { cidade: true },
    }),

  create: async (data: any) => {
    const conditions: any[] = [{ nome: data.nome, oficina_id: data.oficina_id }];
    if (data.email) conditions.push({ email: data.email, oficina_id: data.oficina_id });

    const existing = await prisma.fornecedor.findFirst({ where: { deleted_at: { not: null }, OR: conditions } });

    if (existing) {
      return prisma.fornecedor.update({
        where: { id: existing.id },
        data: {
          nome: data.nome,
          contato: data.contato ?? null,
          telefone: data.telefone ?? null,
          email: data.email ?? null,
          logradouro: data.logradouro ?? null,
          numero: data.numero ?? null,
          complemento: data.complemento ?? null,
          cep: data.cep ?? null,
          cidade_id: data.cidade_id ?? null,
          deleted_at: null,
        },
      });
    }

    return prisma.fornecedor.create({
      data: {
        oficina_id: data.oficina_id,
        nome: data.nome,
        contato: data.contato ?? null,
        telefone: data.telefone ?? null,
        email: data.email ?? null,
        logradouro: data.logradouro ?? null,
        numero: data.numero ?? null,
        complemento: data.complemento ?? null,
        cep: data.cep ?? null,
        cidade_id: data.cidade_id ?? null,
      },
    });
  },

  update: async (id: number, data: any, oficinaId: number) => {
    const existing = await prisma.fornecedor.findFirst({ where: { id, oficina_id: oficinaId, deleted_at: null } });
    if (!existing) throw new Error("Fornecedor nao encontrado nesta oficina.");
    return prisma.fornecedor.update({ where: { id }, data: camposEditaveisFornecedor(data) });
  },

  remove: async (id: number, oficinaId: number) => {
    const existing = await prisma.fornecedor.findFirst({ where: { id, oficina_id: oficinaId, deleted_at: null } });
    if (!existing) throw new Error("Fornecedor nao encontrado nesta oficina.");
    return prisma.fornecedor.update({ where: { id }, data: { deleted_at: new Date() } });
  },
};
