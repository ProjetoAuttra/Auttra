CREATE TABLE IF NOT EXISTS "password_reset_token" (
  "id" SERIAL PRIMARY KEY,
  "usuario_id" INTEGER NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_token_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_token_token_hash_key" ON "password_reset_token"("token_hash");
CREATE INDEX IF NOT EXISTS "password_reset_token_usuario_id_idx" ON "password_reset_token"("usuario_id");
CREATE INDEX IF NOT EXISTS "password_reset_token_expires_at_idx" ON "password_reset_token"("expires_at");
CREATE INDEX IF NOT EXISTS "password_reset_token_used_at_idx" ON "password_reset_token"("used_at");
