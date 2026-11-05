import type { Response } from "express";

/** Erro de regra de negocio com status HTTP proprio (ex.: 409 para conflito de estado). */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly code?: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const isNotFoundMessage = (message: string) => /n[aã]o encontrad/i.test(message);

/** Erro escrito por nós para o usuário ler: HttpError ou Error simples lançado por um service. */
export const isErroDeNegocio = (err: unknown): err is Error =>
  err instanceof HttpError || (err instanceof Error && err.constructor === Error);

/** Erro 4xx do próprio Express (JSON malformado, corpo grande demais): a mensagem é segura de mostrar. */
const erroDoExpress = (err: unknown) => {
  const e = err as { status?: unknown; expose?: unknown; message?: unknown } | null;
  return e && typeof e.status === "number" && e.status >= 400 && e.status < 500 && e.expose === true
    ? { status: e.status, message: String(e.message) }
    : null;
};

/**
 * Mensagem que pode ir para o usuário. Erro de regra de negócio mostra o próprio texto.
 * Qualquer outro (Prisma, TypeError...) mostra só o `fallback`: a mensagem crua pode trazer
 * nomes de tabelas, colunas e trechos do código.
 */
export function mensagemSegura(err: unknown, fallback = "Erro interno.") {
  return isErroDeNegocio(err) ? err.message : fallback;
}

/**
 * Traduz erros de service em resposta HTTP:
 * - HttpError: status e codigo definidos por quem lancou
 * - Error simples (regra de negocio dos services): 404 se "nao encontrado", senao 400
 * - erro 4xx do Express (ex.: JSON malformado): o status e a mensagem dele
 * - qualquer outra coisa (Prisma, TypeError...): 500 com mensagem generica, detalhes so no log
 */
export function sendServiceError(res: Response, err: unknown, context: string) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, ...(err.code ? { code: err.code } : {}) });
  }
  if (isErroDeNegocio(err)) {
    return res.status(isNotFoundMessage(err.message) ? 404 : 400).json({ message: err.message });
  }
  const express = erroDoExpress(err);
  if (express) return res.status(express.status).json({ message: express.message });
  console.error(`Erro em ${context}:`, err);
  return res.status(500).json({ message: "Erro interno." });
}
