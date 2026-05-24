import { prisma } from "../prisma/client.js";

type OficinaCreateData = {
  nome: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  cep: string;
  cidade_id: number;
  telefone?: string;
  email?: string;
  cnpj?: string;
};

function requiredText(value: unknown, field: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} e obrigatorio.`);
  return text;
}

function optionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function optionalDigits(value: unknown) {
  const normalized = digits(value);
  return normalized || null;
}

function validateExactLength(value: string | null, length: number, field: string, required = false) {
  if (!value) {
    if (required) throw new Error(`${field} deve ter ${length} digitos.`);
    return;
  }

  if (value.length !== length) {
    throw new Error(`${field} deve ter ${length} digitos.`);
  }
}

function normalizeEmail(value: unknown) {
  const email = optionalText(value)?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("E-mail invalido.");
  }
  return email;
}

function optionalLogo(value: unknown) {
  const logo = optionalText(value);
  if (!logo) return null;
  if (!logo.startsWith("data:image/")) throw new Error("Logo invalida.");
  return logo;
}

async function ensureUnique(field: "nome" | "cnpj" | "email", value: string | null, oficinaId?: number) {
  if (!value) return;

  const existing = await prisma.oficina.findFirst({
    where: {
      [field]: value,
      deleted_at: null,
      ...(oficinaId ? { id: { not: oficinaId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    const labels = { nome: "nome", cnpj: "CNPJ", email: "e-mail" };
    throw new Error(`Ja existe outra oficina com este ${labels[field]}.`);
  }
}

async function resolveCidade(nome: string, uf: string) {
  const cidade =
    (await prisma.cidade.findFirst({ where: { nome, uf } })) ??
    (await prisma.cidade.create({ data: { nome, uf } }));

  return cidade.id;
}

export const OficinaService = {
  async create(data: OficinaCreateData) {
    const nome = requiredText(data.nome, "Nome da oficina");
    const logradouro = requiredText(data.logradouro, "Logradouro");
    const numero = requiredText(data.numero, "Numero");
    const cep = digits(data.cep);
    const cidade_id = Number(data.cidade_id);
    const cnpj = optionalDigits(data.cnpj);
    const telefone = optionalDigits(data.telefone);
    const email = normalizeEmail(data.email);
    const complemento = optionalText(data.complemento);

    validateExactLength(cep, 8, "CEP", true);
    validateExactLength(cnpj, 14, "CNPJ");
    if (telefone && ![10, 11].includes(telefone.length)) {
      throw new Error("Telefone deve ter 10 ou 11 digitos.");
    }
    if (!cidade_id || Number.isNaN(cidade_id)) {
      throw new Error("Cidade e obrigatoria.");
    }

    await ensureUnique("nome", nome);
    await ensureUnique("cnpj", cnpj);
    await ensureUnique("email", email);

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

  async getById(id: number) {
    return prisma.oficina.findFirst({
      where: { id, deleted_at: null },
      include: { cidade: true },
    });
  },

  async update(id: number, data: any) {
    const existing = await prisma.oficina.findFirst({
      where: { id, deleted_at: null },
      select: { id: true },
    });
    if (!existing) throw new Error("Oficina nao encontrada.");

    const patch: any = {};

    if (data?.nome !== undefined) patch.nome = requiredText(data.nome, "Nome da empresa");
    if (data?.cnpj !== undefined) {
      patch.cnpj = optionalDigits(data.cnpj);
      validateExactLength(patch.cnpj, 14, "CNPJ");
    }
    if (data?.email !== undefined) patch.email = normalizeEmail(data.email);
    if (data?.logo_url !== undefined) patch.logo_url = optionalLogo(data.logo_url);
    if (data?.telefone !== undefined) {
      patch.telefone = optionalDigits(data.telefone);
      if (patch.telefone && ![10, 11].includes(patch.telefone.length)) {
        throw new Error("Telefone deve ter 10 ou 11 digitos.");
      }
    }
    if (data?.logradouro !== undefined) patch.logradouro = requiredText(data.logradouro, "Logradouro");
    if (data?.numero !== undefined) patch.numero = requiredText(data.numero, "Numero");
    if (data?.complemento !== undefined) patch.complemento = optionalText(data.complemento);
    if (data?.cep !== undefined) {
      patch.cep = digits(data.cep);
      validateExactLength(patch.cep, 8, "CEP", true);
    }

    const hasCidade = data?.cidade_nome !== undefined || data?.cidade_uf !== undefined;
    if (hasCidade) {
      const nomeCidade = requiredText(data.cidade_nome, "Cidade");
      const uf = requiredText(data.cidade_uf, "UF").toUpperCase();
      if (!/^[A-Z]{2}$/.test(uf)) throw new Error("UF deve ter 2 letras.");
      patch.cidade_id = await resolveCidade(nomeCidade, uf);
    }

    await ensureUnique("nome", patch.nome ?? null, id);
    await ensureUnique("cnpj", patch.cnpj ?? null, id);
    await ensureUnique("email", patch.email ?? null, id);

    return prisma.oficina.update({
      where: { id },
      data: patch,
      include: { cidade: true },
    });
  },
};
