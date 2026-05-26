DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_oficina_admin') THEN
    CREATE TYPE "status_oficina_admin" AS ENUM ('implantacao', 'ativa', 'suspensa', 'cancelada');
  END IF;
END $$;

ALTER TABLE "usuario"
  ADD COLUMN IF NOT EXISTS "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_login_ip" TEXT,
  ADD COLUMN IF NOT EXISTS "last_login_user_agent" TEXT;

ALTER TABLE "oficina"
  ADD COLUMN IF NOT EXISTS "status_admin" "status_oficina_admin" NOT NULL DEFAULT 'ativa',
  ADD COLUMN IF NOT EXISTS "notas_internas" TEXT,
  ADD COLUMN IF NOT EXISTS "implantacao_checklist" JSONB NOT NULL DEFAULT '{"dados_completos":false,"gestor_criado":false,"perfis_criados":false,"primeiro_acesso":false,"logo_cadastrada":false,"usuarios_convidados":false}';

CREATE TABLE IF NOT EXISTS "admin_audit_log" (
  "id" SERIAL NOT NULL,
  "actor_id" INTEGER,
  "oficina_id" INTEGER,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" INTEGER,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "ip" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_log_actor_id_fkey'
  ) THEN
    ALTER TABLE "admin_audit_log"
      ADD CONSTRAINT "admin_audit_log_actor_id_fkey"
      FOREIGN KEY ("actor_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_log_oficina_id_fkey'
  ) THEN
    ALTER TABLE "admin_audit_log"
      ADD CONSTRAINT "admin_audit_log_oficina_id_fkey"
      FOREIGN KEY ("oficina_id") REFERENCES "oficina"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "admin_audit_log_actor_id_idx" ON "admin_audit_log"("actor_id");
CREATE INDEX IF NOT EXISTS "admin_audit_log_oficina_id_idx" ON "admin_audit_log"("oficina_id");
CREATE INDEX IF NOT EXISTS "admin_audit_log_action_idx" ON "admin_audit_log"("action");
CREATE INDEX IF NOT EXISTS "admin_audit_log_entity_type_entity_id_idx" ON "admin_audit_log"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "admin_audit_log_created_at_idx" ON "admin_audit_log"("created_at");
