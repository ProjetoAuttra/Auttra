import { z } from "zod";

export const criarOficinaSchema = z.object({
  oficina: z.object({
    nome: z.string().trim().min(1, "Nome da oficina é obrigatório."),
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
  logradouro: z.string().trim().min(1).optional(),
  numero: z.string().trim().min(1).optional(),
  cep: z.string().trim().min(8).optional(),
  complemento: z.string().trim().optional(),
  telefone: z.string().trim().optional(),
  email: z.string().email().optional(),
});
