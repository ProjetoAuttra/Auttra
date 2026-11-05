import type { NextFunction, Request, Response } from "express";
import { sendServiceError } from "../utils/httpError.js";

/**
 * Último tratador de erros. O Express 5 traz para cá o erro de qualquer rota `async`, então os
 * controllers não precisam de try/catch só para responder o erro. Nunca devolve a mensagem crua
 * de um erro inesperado: ela vai só para o log.
 */
export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  return sendServiceError(res, err, `${req.method} ${req.originalUrl}`);
};
