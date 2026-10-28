import type { Request, Response } from "express";

// Sessao do painel admin fica em cookie httpOnly: o JS da pagina nunca enxerga o token.
// SameSite=Strict bloqueia o envio em requisicoes vindas de outros sites (protecao contra CSRF),
// por isso o admin precisa chamar a API pela mesma origem (proxy /api do nginx ou do Vite).
export const ADMIN_COOKIE = "auttra_admin_token";
const ADMIN_COOKIE_PATH = "/api/admin";
const ADMIN_SESSION_MS = 2 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict" as const,
    path: ADMIN_COOKIE_PATH,
  };
}

export function setAdminCookie(res: Response, token: string) {
  res.cookie(ADMIN_COOKIE, token, { ...cookieOptions(), maxAge: ADMIN_SESSION_MS });
}

export function clearAdminCookie(res: Response) {
  res.clearCookie(ADMIN_COOKIE, cookieOptions());
}

export function readAdminCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === ADMIN_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}
