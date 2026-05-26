-- Add TOTP 2FA secret to usuario
ALTER TABLE "usuario" ADD COLUMN IF NOT EXISTS "totp_secret" TEXT;
