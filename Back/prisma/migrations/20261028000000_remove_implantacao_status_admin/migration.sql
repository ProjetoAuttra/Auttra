-- Status da oficina passa a ser apenas ativa/inativa (deleted_at); checklist de implantacao removido.
-- IF EXISTS: implantacao_checklist estava no schema mas nem todo banco chegou a ter a coluna.
ALTER TABLE "oficina" DROP COLUMN IF EXISTS "status_admin";
ALTER TABLE "oficina" DROP COLUMN IF EXISTS "implantacao_checklist";
DROP TYPE IF EXISTS "status_oficina_admin";
