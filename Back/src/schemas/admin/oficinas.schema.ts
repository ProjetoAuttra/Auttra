import { z } from "zod";

export const criarOficinaSchema = z.object({
  oficina: z.object({
    nome: z.string().trim().min(1, "Nome da oficina é obrigatório."),
    cnpj: z.string().trim().optional(),
    logradouro: z.string().trim().min(1, "Logradouro é obrigatório."),
    numero: z.string().trim().min(1, "Número é obrigatório."),
    cep: z.string().trim().min(8, "CEP inválido."),
    cidade: z.string().trim().min(1, "Cidade é obrigatória."),
    uf: z.string().trim().length(2, "UF deve ter 2 caracteres."),
    complemento: z.string().trim().optional(),
    telefone: z.string().trim().optional(),
    email: z.string().email("E-mail da oficina inválido.").optional(),
  }),
  gestor: z.object({
    nome: z.string().trim().min(1, "Nome do gestor é obrigatório."),
    email: z.string().email("E-mail do gestor inválido."),
    senha: z.string().min(6, "Senha deve ter pelo menos 6 caracteres."),
  }),
});

export const updateOficinaSchema = z.object({
  nome: z.string().trim().min(1).optional(),
  cnpj: z.string().trim().nullable().optional(),
  logradouro: z.string().trim().min(1).optional(),
  numero: z.string().trim().min(1).optional(),
  cep: z.string().trim().min(8).optional(),
  cidade: z.string().trim().min(1).optional(),
  uf: z.string().trim().length(2).optional(),
  complemento: z.string().trim().nullable().optional(),
  telefone: z.string().trim().nullable().optional(),
  email: z.string().email().nullable().optional(),
  gestor_usuario_id: z.number().int().positive().nullable().optional(),
  status_admin: z.enum(["implantacao", "ativa", "suspensa", "cancelada"]).optional(),
  notas_internas: z.string().trim().nullable().optional(),
  implantacao_checklist: z.record(z.string(), z.boolean()).optional(),
});
