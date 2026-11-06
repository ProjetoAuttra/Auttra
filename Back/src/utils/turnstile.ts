import { getTurnstileSecret } from "../config/env.js";
import { HttpError } from "./httpError.js";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Confere com o Cloudflare o token do Turnstile ("não sou um robô"). Passa em silêncio quando vale;
 * lança 400 sem token, 401 (`CAPTCHA_FAILED`) quando o Cloudflare recusa e 502 se ele não responder.
 */
export async function verificarTurnstile(token: unknown, ip?: string | null) {
  const response = typeof token === "string" ? token.trim() : "";
  if (!response) throw new HttpError("Verificacao de seguranca obrigatoria.", 400, "CAPTCHA_REQUIRED");

  let resultado: { success?: boolean };
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: getTurnstileSecret(), response, remoteip: ip ?? "" }),
    });
    resultado = await res.json();
  } catch (err) {
    console.error("Erro ao contatar o Cloudflare Turnstile:", err);
    throw new HttpError("Nao foi possivel validar a verificacao de seguranca. Tente novamente.", 502);
  }

  if (!resultado?.success) {
    throw new HttpError("Nao foi possivel confirmar que voce nao e um robo. Tente novamente.", 401, "CAPTCHA_FAILED");
  }
}
