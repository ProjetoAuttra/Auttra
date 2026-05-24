import { prisma } from "../prisma/client.js";
import type { status_cliente } from "@prisma/client";

type ClienteInput = {
  nome: string;
  email?: string | null;
  cpf?: string | null;
  telefone?: string | null;
  data_nascimento?: string | Date | null;
  status?: status_cliente | null;
  observacao?: string | null;
  observacoes?: string | null;
  oficina_id?: number;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  cidade_id?: number | null;
};

function parseDataNascimento(value: ClienteInput["data_nascimento"]) {
  if (value == null || value === "") return value === null ? null : undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("data_nascimento invalida.");
  }
  return date;
}

function isCPFValido(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== Number(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === Number(d[10]);
}

function isCNPJValido(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;

  const calc = (base: string, weights: number[]) => {
    const sum = weights.reduce((acc, weight, index) => acc + Number(base[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const digit1 = calc(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const digit2 = calc(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digit1 === Number(d[12]) && digit2 === Number(d[13]);
}

function normalizeDocumento(value: string | null | undefined) {
  if (value == null || value === "") return value === null ? null : undefined;
  const digits = value.replace(/\D/g, "");
  if (!digits) return undefined;
  const valid = digits.length === 11 ? isCPFValido(digits) : digits.length === 14 ? isCNPJValido(digits) : false;
  if (!valid) throw new Error("CPF/CNPJ invalido.");
  return digits;
}

function getObservacao(data: ClienteInput) {
  return data.observacao ?? data.observacoes;
}

export const ClienteService = {

  async listar(oficinaId: number, search: string = "") {
    const where: any = { deleted_at: null, oficina_id: oficinaId };

    if (search.trim().length > 0) {
      const searchDigits = search.replace(/\D/g, "");
      where.OR = [
        { nome: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { telefone: { contains: search, mode: "insensitive" } },
        ...(searchDigits ? [{ cpf: { contains: searchDigits, mode: "insensitive" } }] : []),
      ];
    }

    return await prisma.cliente.findMany({
      where,
      orderBy: { nome: "asc" },
      take: 200,
    });
  },

  async getDetalhes(id: number, oficina_id: number) {
    const cliente = await prisma.cliente.findFirst({
      where: { id, deleted_at: null, oficina_id },
      include: {
        cidade: true,
        veiculos: {
          where: { deleted_at: null },
          orderBy: { created_at: "desc" },
        },
        ordens: {
          where: { deleted_at: null },
          orderBy: { created_at: "desc" },
          include: { veiculo: true, funcionario: true },
        },
        pagamentos: {
          where: { deleted_at: null },
          orderBy: { data_vencimento: "desc" },
        },
      },
    });

    if (!cliente) throw new Error("Cliente nao encontrado.");
    return cliente;
  },

  async criar(data: ClienteInput) {
    if (!data.nome) throw new Error("Nome e obrigatorio.");
    if (!data.oficina_id) throw new Error("oficina_id e obrigatorio.");

    const documento = normalizeDocumento(data.cpf);
    const conditions: any[] = [];
    if (documento) conditions.push({ cpf: documento, oficina_id: data.oficina_id });
    if (data.email) conditions.push({ email: data.email, oficina_id: data.oficina_id });

    const existing = conditions.length > 0
      ? await prisma.cliente.findFirst({ where: { deleted_at: { not: null }, OR: conditions } })
      : null;

    if (existing) {
      return prisma.cliente.update({
        where: { id: existing.id },
        data: {
          nome: data.nome,
          email: data.email,
          cpf: documento,
          telefone: data.telefone,
          data_nascimento: parseDataNascimento(data.data_nascimento),
          status: data.status ?? "ativo",
          observacao: getObservacao(data),
          cep: data.cep,
          logradouro: data.logradouro,
          numero: data.numero,
          complemento: data.complemento,
          cidade_id: data.cidade_id,
          deleted_at: null,
        },
      });
    }

    return await prisma.cliente.create({
      data: {
        nome: data.nome,
        email: data.email,
        cpf: documento,
        telefone: data.telefone,
        data_nascimento: parseDataNascimento(data.data_nascimento),
        status: data.status ?? undefined,
        observacao: getObservacao(data),
        oficina_id: data.oficina_id,
        cep: data.cep,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        cidade_id: data.cidade_id,
      },
    });
  },

  async atualizar(id: number, data: ClienteInput, oficina_id: number) {
    const cliente = await prisma.cliente.findFirst({ where: { id, deleted_at: null, oficina_id } });
    if (!cliente) throw new Error("Cliente nao encontrado.");

    const documento = normalizeDocumento(data.cpf);
    return prisma.cliente.update({
      where: { id },
      data: {
        nome: data.nome,
        email: data.email,
        cpf: documento,
        telefone: data.telefone,
        data_nascimento: parseDataNascimento(data.data_nascimento),
        status: data.status ?? undefined,
        observacao: getObservacao(data),
        cep: data.cep,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        cidade_id: data.cidade_id,
      },
    });
  },

  async deletar(id: number, oficina_id: number) {
    const cliente = await prisma.cliente.findFirst({ where: { id, deleted_at: null, oficina_id } });
    if (!cliente) throw new Error("Cliente nao encontrado.");

    await prisma.cliente.update({ where: { id }, data: { deleted_at: new Date(), status: "inativo" } });
  },

  listarVeiculosDoCliente(clienteId: number, oficina_id: number) {
    return prisma.veiculo.findMany({
      where: { cliente_id: clienteId, deleted_at: null, oficina_id },
      orderBy: { id: "desc" },
    });
  },
};
