const INSECURE_JWT_SECRETS = new Set([
  "troque-esta-chave-em-producao",
  "change-me",
  "changeme",
  "secret",
  "jwt-secret",
]);

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("JWT_SECRET nao configurado.");
  }

  if (process.env.NODE_ENV === "production") {
    if (INSECURE_JWT_SECRETS.has(secret) || secret.length < 32) {
      throw new Error("JWT_SECRET inseguro para producao.");
    }
  }

  return secret;
}

const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

export function getTurnstileSecret() {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("TURNSTILE_SECRET_KEY nao configurado.");
  }

  console.warn(
    "[turnstile] TURNSTILE_SECRET_KEY nao definido — usando chave de teste do Cloudflare (sempre aprova). Configure para producao."
  );
  return TURNSTILE_TEST_SECRET_KEY;
}

export function validateRuntimeEnv() {
  getJwtSecret();
  getTurnstileSecret();
}
