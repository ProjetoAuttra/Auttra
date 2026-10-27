import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AccessAction, AccessModule, PermissionsMap } from "../permissions/accessProfiles.js";
import { canAccess } from "../permissions/accessProfiles.js";
import { getJwtSecret } from "../config/env.js";
import { sessaoValida } from "../services/sessao.service.js";

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
  /** Versão do token do usuário no momento do login; trocar a senha invalida os anteriores. */
  tv?: number;
};

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let token = "";
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2) {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Token não informado" });
  }

  let decoded: UserPayload;
  try {
    decoded = jwt.verify(token, getJwtSecret()) as UserPayload;
  } catch {
    return res.status(401).json({ message: "Token inválido" });
  }

  // Tokens de uso único (seleção de oficina, 2FA pendente, e-mail verificado) não autenticam requisições.
  if (typeof decoded.id !== "number" || (decoded as { purpose?: string }).purpose) {
    return res.status(401).json({ message: "Token inválido" });
  }

  try {
    if (!(await sessaoValida(decoded))) {
      return res.status(401).json({ message: "Sessão encerrada. Faça login novamente." });
    }
  } catch (err) {
    console.error("Erro ao validar sessão:", err);
    return res.status(500).json({ message: "Erro interno ao validar a sessão." });
  }

  req.user = decoded;
  next();
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
