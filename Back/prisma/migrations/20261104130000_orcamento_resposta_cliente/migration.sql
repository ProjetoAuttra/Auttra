-- B1: resposta do cliente ao orçamento pelo link público.
ALTER TABLE "orcamento"
  ADD COLUMN "respondido_em" TIMESTAMPTZ(3),
  ADD COLUMN "respondido_por_nome" TEXT,
  ADD COLUMN "respondido_ip" TEXT,
  ADD COLUMN "respondido_pelo_cliente" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "motivo_recusa" TEXT;
