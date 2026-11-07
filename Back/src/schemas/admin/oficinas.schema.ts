import { z } from "zod";
import { UFS, apenasDigitos, cnpjValido, cpfValido } from "../../utils/documentos.js";

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

// Mesma regra do telefone, com mensagem própria.
const whatsapp = z.string()
  .transform(apenasDigitos)
  .refine((v) => !v || v.length === 10 || v.length === 11, "WhatsApp deve ter 10 ou 11 dígitos, com DDD.")
  .transform((v) => v || null);

// Formato varia por estado; aceita dígitos e separadores, ou "ISENTO".
const inscricaoEstadual = z.string().trim().toUpperCase()
  .refine((v) => !v || v === "ISENTO" || /^[0-9./-]{2,20}$/.test(v), "Inscrição estadual inválida. Use só números ou ISENTO.")
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
  bairro: textoOpcional("Bairro", 80),
  telefone,
  whatsapp,
  email: emailOpcional,
  razao_social: textoOpcional("Razão social", 150),
  inscricao_estadual: inscricaoEstadual,
};

// Proprietario = gestor da oficina: a conta principal, que assina o servico.
const cpf = z.string()
  .transform(apenasDigitos)
  .refine((v) => !v || cpfValido(v), "CPF inválido.")
  .transform((v) => v || null);

const dataNascimento = z.string().trim()
  .refine((v) => {
    if (!v) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const data = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(data.getTime()) && data.toISOString().startsWith(v) && v >= "1900-01-01" && data <= new Date();
  }, "Data de nascimento inválida.")
  .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));

const camposProprietario = {
  nome: texto("Nome do proprietário", 120),
  email: z.string().trim().toLowerCase().email("E-mail do proprietário inválido.").max(120),
  cpf: cpf.optional(),
  telefone: telefone.optional(),
  data_nascimento: dataNascimento.optional(),
};

export const proprietarioSchema = z.object({
  usuario_id: z.number().int().positive(),
  ...camposProprietario,
  cpf: cpf.nullable().optional(),
  telefone: telefone.nullable().optional(),
  data_nascimento: dataNascimento.nullable().optional(),
});

export const criarOficinaSchema = z.object({
  oficina: z.object({
    ...campos,
    cnpj: campos.cnpj.optional(),
    complemento: campos.complemento.optional(),
    bairro: campos.bairro.optional(),
    telefone: campos.telefone.optional(),
    whatsapp: campos.whatsapp.optional(),
    email: campos.email.optional(),
    razao_social: campos.razao_social.optional(),
    inscricao_estadual: campos.inscricao_estadual.optional(),
  }),
  // A API mantem o nome "gestor"; no painel ele aparece como Proprietario.
  gestor: z.object(camposProprietario),
  // Oficina criada pelo painel começa em teste de 7 dias ou já ativa (padrão: ativa, como sempre foi).
  assinatura: z.enum(["teste", "ativa"]).optional(),
});

// Na edição o endereço é opcional (oficina vinda do site não tem): vazio vira null.
const cepOpcional = z.string()
  .transform(apenasDigitos)
  .refine((v) => !v || v.length === 8, "CEP deve ter 8 dígitos.")
  .transform((v) => v || null);

const ufOpcional = z.string().trim().toUpperCase()
  .refine((v) => !v || (UFS as readonly string[]).includes(v), "UF inválida.")
  .transform((v) => v || null);

export const updateOficinaSchema = z.object({
  nome: campos.nome.optional(),
  logradouro: textoOpcional("Logradouro", 150).nullable().optional(),
  numero: textoOpcional("Número", 10).nullable().optional(),
  cidade: textoOpcional("Cidade", 80).nullable().optional(),
  cep: cepOpcional.nullable().optional(),
  uf: ufOpcional.nullable().optional(),
  cnpj: campos.cnpj.nullable().optional(),
  complemento: campos.complemento.nullable().optional(),
  bairro: campos.bairro.nullable().optional(),
  telefone: campos.telefone.nullable().optional(),
  whatsapp: campos.whatsapp.nullable().optional(),
  email: campos.email.nullable().optional(),
  razao_social: campos.razao_social.nullable().optional(),
  inscricao_estadual: campos.inscricao_estadual.nullable().optional(),
  gestor_usuario_id: z.number().int().positive().nullable().optional(),
  notas_internas: z.string().trim().max(5000, "Observações devem ter no máximo 5000 caracteres.").nullable().optional(),
});

// Dia no formato do <input type="date"> (YYYY-MM-DD), conferindo que a data existe.
const dia = (campo: string) =>
  z.string().trim().refine((v) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const data = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(data.getTime()) && data.toISOString().startsWith(v);
  }, `${campo} inválida.`);

/** Ações de assinatura do painel: ativar com plano, estender o teste ou suspender. */
export const assinaturaSchema = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("ativar"),
    plano: z.enum(["mensal", "semestral"], { message: "Escolha o plano: mensal ou semestral." }),
    ativada_em: dia("Data de ativação").optional(),
  }),
  z.object({
    acao: z.literal("estender_teste"),
    dias: z.number().int().min(1, "Estenda por pelo menos 1 dia.").max(90, "Estenda por no máximo 90 dias.").optional(),
    termina_em: dia("Data de fim do teste").optional(),
  }).refine((d) => (d.dias === undefined) !== (d.termina_em === undefined), "Informe os dias a mais ou a nova data de fim do teste."),
  z.object({
    acao: z.literal("suspender"),
    motivo: z.string().trim().max(500, "Motivo deve ter no máximo 500 caracteres.").optional(),
  }),
], { error: "Ação de assinatura inválida." });

export type AssinaturaAcao = z.infer<typeof assinaturaSchema>;

/** Primeira mensagem de validacao, para o painel mostrar algo acionavel em vez de "Dados invalidos". */
export function primeiroErro(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
