import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AccessAction, AccessModule, PermissionsMap } from "../permissions/accessProfiles.js";
import { canAccess } from "../permissions/accessProfiles.js";
import { getJwtSecret } from "../config/env.js";

export type UserPayload = {
  id: number;
  email: string;
  nome: string;
  tipo: string;
  oficinaId: number;
  oficina_id?: number;
  perfilAcessoId?: number | null;
  perfilAcessoNome?: string | null;
  permissoes?: PermissionsMap;
};

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Token não informado" });
  }

  const [, token] = authHeader.split(" ");

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as UserPayload;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido" });
  }
};

export const officeScopeMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const oficinaId = Number(req.user?.oficinaId ?? req.user?.oficina_id);
  if (!oficinaId || Number.isNaN(oficinaId)) {
    return res.status(403).json({ message: "Token sem oficina ativa." });
  }

  req.query.oficina_id = String(oficinaId);
  req.params.oficina_id = String(oficinaId);

  if (req.body && typeof req.body === "object") {
    req.body.oficina_id = oficinaId;
    req.body.oficinaId = oficinaId;
  }

  next();
};

export function getRequiredOfficeId(req: Request) {
  const oficinaId = Number(req.user?.oficinaId ?? req.user?.oficina_id);
  if (!oficinaId || Number.isNaN(oficinaId)) {
    throw new Error("Token sem oficina ativa.");
  }
  return oficinaId;
}

export const requirePermission = (module: AccessModule, action: AccessAction = "read") => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (canAccess(req.user?.permissoes, module, action)) return next();

    return res.status(403).json({
      message: "Voce nao tem permissao para executar esta acao.",
      module,
      action,
    });
  };
};
