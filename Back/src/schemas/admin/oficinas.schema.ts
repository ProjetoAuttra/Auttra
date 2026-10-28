import { z } from "zod";
import { UFS, apenasDigitos, cnpjValido } from "../../utils/documentos.js";

// Mesmas regras do app das oficinas: CNPJ, CEP e telefone sao gravados so com digitos.
const texto = (campo: string, max: number) =>
  z.string().trim()
    .min(1, `${campo} é obrigatório.`)
    .max(max, `${campo} deve ter no máximo ${max} caracteres.`);

const textoOpcional = (campo: string, max: number) =>
  z.string().trim()
    .max(max, `${campo} deve ter no máximo ${max} caracteres.`)
    .transform((v) => v || null);

const cep = z.string()
  .transform(apenasDigitos)
  .refine((v) => v.length === 8, "CEP deve ter 8 dígitos.");

const cnpj = z.string()
  .transform(apenasDigitos)
  .refine((v) => !v || cnpjValido(v), "CNPJ inválido.")
  .transform((v) => v || null);

const telefone = z.string()
  .transform(apenasDigitos)
  .refine((v) => !v || v.length === 10 || v.length === 11, "Telefone deve ter 10 ou 11 dígitos, com DDD.")
  .transform((v) => v || null);

const uf = z.string().trim().toUpperCase()
  .refine((v) => (UFS as readonly string[]).includes(v), "UF inválida.");

const emailOpcional = z.string().trim().toLowerCase()
  .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail da oficina inválido.")
  .transform((v) => v || null);

const campos = {
  nome: texto("Nome da oficina", 120),
  logradouro: texto("Logradouro", 150),
  numero: texto("Número", 10),
  cidade: texto("Cidade", 80),
  cep,
  uf,
  cnpj,
  complemento: textoOpcional("Complemento", 80),
  telefone,
  email: emailOpcional,
};

export const criarOficinaSchema = z.object({
  oficina: z.object({
    ...campos,
    cnpj: campos.cnpj.optional(),
    complemento: campos.complemento.optional(),
    telefone: campos.telefone.optional(),
    email: campos.email.optional(),
  }),
  gestor: z.object({
    nome: texto("Nome do gestor", 120),
    email: z.string().trim().toLowerCase().email("E-mail do gestor inválido."),
  }),
});

export const updateOficinaSchema = z.object({
  nome: campos.nome.optional(),
  logradouro: campos.logradouro.optional(),
  numero: campos.numero.optional(),
  cidade: campos.cidade.optional(),
  cep: campos.cep.optional(),
  uf: campos.uf.optional(),
  cnpj: campos.cnpj.nullable().optional(),
  complemento: campos.complemento.nullable().optional(),
  telefone: campos.telefone.nullable().optional(),
  email: campos.email.nullable().optional(),
  gestor_usuario_id: z.number().int().positive().nullable().optional(),
  notas_internas: z.string().trim().max(5000, "Observações devem ter no máximo 5000 caracteres.").nullable().optional(),
});

/** Primeira mensagem de validacao, para o painel mostrar algo acionavel em vez de "Dados invalidos". */
export function primeiroErro(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
