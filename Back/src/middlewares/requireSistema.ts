import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/env.js";
import { readAdminCookie } from "../utils/adminCookie.js";
import { sessaoValida } from "../services/sessao.service.js";
import type { UserPayload } from "./ensureAuth.js";

export const requireSistema = async (req: Request, res: Response, next: NextFunction) => {
  const token = readAdminCookie(req);
  if (!token) {
    return res.status(401).json({ message: "Sessão não encontrada." });
  }

  let decoded: UserPayload;
  try {
    decoded = jwt.verify(token, getJwtSecret()) as UserPayload;
  } catch {
    return res.status(401).json({ message: "Token inválido." });
  }

  try {

    // token de oficina (login normal) nunca vale como token do painel admin, mesmo com tipo "sistema"
    if (decoded.tipo !== "sistema" || decoded.oficinaId || decoded.oficina_id) {
      return res.status(403).json({ message: "Acesso restrito ao painel admin." });
    }

    // Conta desativada ou senha trocada (token_version) derruba a sessao na hora, sem esperar o JWT expirar.
    if (!(await sessaoValida(decoded))) {
      return res.status(401).json({ message: "Sessão expirada. Faça login novamente." });
    }

    req.user = decoded;
    next();
  } catch (err) {
    next(err);
  }
};
