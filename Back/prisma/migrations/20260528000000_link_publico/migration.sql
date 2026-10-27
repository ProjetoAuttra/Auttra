CREATE TYPE "status_link_publico" AS ENUM ('ativo', 'cancelado');

CREATE TABLE "link_publico" (
  "id" UUID NOT NULL,
  "oficina_id" INTEGER NOT NULL,
  "ordem_servico_id" INTEGER,
  "orcamento_id" INTEGER,
  "status" "status_link_publico" NOT NULL DEFAULT 'ativo',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "link_publico_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "link_publico_um_alvo_chk" CHECK (("ordem_servico_id" IS NULL) <> ("orcamento_id" IS NULL))
);

CREATE INDEX "link_publico_oficina_id_idx" ON "link_publico"("oficina_id");
CREATE INDEX "link_publico_ordem_servico_id_status_idx" ON "link_publico"("ordem_servico_id", "status");
CREATE INDEX "link_publico_orcamento_id_status_idx" ON "link_publico"("orcamento_id", "status");

ALTER TABLE "link_publico" ADD CONSTRAINT "link_publico_oficina_id_fkey"
  FOREIGN KEY ("oficina_id") REFERENCES "oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "link_publico" ADD CONSTRAINT "link_publico_ordem_servico_id_fkey"
  FOREIGN KEY ("ordem_servico_id") REFERENCES "ordem_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "link_publico" ADD CONSTRAINT "link_publico_orcamento_id_fkey"
  FOREIGN KEY ("orcamento_id") REFERENCES "orcamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
