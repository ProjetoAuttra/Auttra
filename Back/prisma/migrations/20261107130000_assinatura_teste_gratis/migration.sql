-- Cadastro pelo site, teste grátis de 7 dias e assinatura.

CREATE TYPE "status_assinatura" AS ENUM ('teste', 'ativa', 'suspensa');
CREATE TYPE "plano_assinatura" AS ENUM ('mensal', 'semestral');
CREATE TYPE "origem_oficina" AS ENUM ('admin', 'cadastro');

-- Oficinas que já existem entram como ativas (o default cobre as linhas atuais).
ALTER TABLE "oficina"
  ADD COLUMN "assinatura_status" "status_assinatura" NOT NULL DEFAULT 'ativa',
  ADD COLUMN "teste_termina_em" TIMESTAMPTZ(3),
  ADD COLUMN "assinatura_plano" "plano_assinatura",
  ADD COLUMN "assinatura_ativada_em" TIMESTAMPTZ(3),
  ADD COLUMN "origem" "origem_oficina" NOT NULL DEFAULT 'admin',
  ADD COLUMN "origem_campanha" JSONB;

-- Endereço opcional: o cadastro pelo site não pede.
ALTER TABLE "oficina"
  ALTER COLUMN "logradouro" DROP NOT NULL,
  ALTER COLUMN "numero" DROP NOT NULL,
  ALTER COLUMN "cep" DROP NOT NULL,
  ALTER COLUMN "cidade_id" DROP NOT NULL;

-- Nome deixa de ser único: duas "Auto Center São José" em cidades diferentes podem existir.
DROP INDEX "oficina_nome_key";

CREATE INDEX "oficina_assinatura_status_teste_termina_em_idx" ON "oficina"("assinatura_status", "teste_termina_em");
CREATE INDEX "oficina_created_at_idx" ON "oficina"("created_at");

-- Confirmação de e-mail. Contas que já existem foram criadas por convite (o link chegou no e-mail): contam como confirmadas.
ALTER TABLE "usuario" ADD COLUMN "email_confirmado_em" TIMESTAMPTZ(3);
UPDATE "usuario" SET "email_confirmado_em" = "created_at";
