import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/env.js";
import type { UserPayload } from "./ensureAuth.js";

export const requireSistema = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Token não informado." });
  }

  const [, token] = authHeader.split(" ");

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as UserPayload;

    if (decoded.tipo !== "sistema") {
      return res.status(403).json({ message: "Acesso restrito ao painel admin." });
    }

    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido." });
  }
};
