import { prisma } from "../prisma/client.js";

function requiredText(value: unknown, field: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} e obrigatorio.`);
  return text;
}

function optionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function optionalDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "") || null;
}

/** Campo opcional: vazio passa; preenchido precisa ter exatamente `length` dígitos. */
function validateExactLength(value: string | null, length: number, field: string) {
  if (value && value.length !== length) {
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

/** Cor principal da marca da oficina, como #RRGGBB; vazio volta para a cor padrão. */
function optionalCor(value: unknown) {
  const cor = optionalText(value);
  if (!cor) return null;
  if (!/^#[0-9a-fA-F]{6}$/.test(cor)) throw new Error("Cor invalida. Use o formato #RRGGBB.");
  return cor.toLowerCase();
}

// O nome não entra: duas oficinas de cidades diferentes podem ter o mesmo nome.
async function ensureUnique(field: "cnpj" | "email", value: string | null, oficinaId?: number) {
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
    const labels = { cnpj: "CNPJ", email: "e-mail" };
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
    if (data?.cor_principal !== undefined) patch.cor_principal = optionalCor(data.cor_principal);
    if (data?.telefone !== undefined) {
      patch.telefone = optionalDigits(data.telefone);
      if (patch.telefone && ![10, 11].includes(patch.telefone.length)) {
        throw new Error("Telefone deve ter 10 ou 11 digitos.");
      }
    }
    if (data?.whatsapp !== undefined) {
      // Vai no botão "Falar com a oficina" do link público (wa.me/55 + DDD + número).
      patch.whatsapp = optionalDigits(data.whatsapp);
      if (patch.whatsapp && ![10, 11].includes(patch.whatsapp.length)) {
        throw new Error("WhatsApp deve ter 10 ou 11 digitos (DDD + numero).");
      }
    }
    // Endereço é opcional (o cadastro pelo site não pede); vazio grava nulo.
    if (data?.logradouro !== undefined) patch.logradouro = optionalText(data.logradouro);
    if (data?.numero !== undefined) patch.numero = optionalText(data.numero);
    if (data?.complemento !== undefined) patch.complemento = optionalText(data.complemento);
    if (data?.cep !== undefined) {
      patch.cep = optionalDigits(data.cep);
      validateExactLength(patch.cep, 8, "CEP");
    }

    const hasCidade = data?.cidade_nome !== undefined || data?.cidade_uf !== undefined;
    if (hasCidade) {
      const nomeCidade = optionalText(data.cidade_nome);
      const uf = optionalText(data.cidade_uf)?.toUpperCase() ?? null;
      if (!nomeCidade && !uf) {
        patch.cidade_id = null;
      } else {
        if (!nomeCidade) throw new Error("Informe a cidade junto com a UF.");
        if (!uf) throw new Error("Informe a UF junto com a cidade.");
        if (!/^[A-Z]{2}$/.test(uf)) throw new Error("UF deve ter 2 letras.");
        patch.cidade_id = await resolveCidade(nomeCidade, uf);
      }
    }

    await ensureUnique("cnpj", patch.cnpj ?? null, id);
    await ensureUnique("email", patch.email ?? null, id);

    return prisma.oficina.update({
      where: { id },
      data: patch,
      include: { cidade: true },
    });
  },
};
