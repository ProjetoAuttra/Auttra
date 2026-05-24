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

export function validateRuntimeEnv() {
  getJwtSecret();
}
