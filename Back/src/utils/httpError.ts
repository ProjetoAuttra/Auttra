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

/**
 * Traduz erros de service em resposta HTTP:
 * - HttpError: status e codigo definidos por quem lancou
 * - Error simples (regra de negocio dos services): 404 se "nao encontrado", senao 400
 * - qualquer outra coisa (Prisma, TypeError...): 500 com mensagem generica, detalhes so no log
 */
export function sendServiceError(res: Response, err: unknown, context: string) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, ...(err.code ? { code: err.code } : {}) });
  }
  if (err instanceof Error && err.constructor === Error) {
    return res.status(isNotFoundMessage(err.message) ? 404 : 400).json({ message: err.message });
  }
  console.error(`Erro em ${context}:`, err);
  return res.status(500).json({ message: "Erro interno." });
}
