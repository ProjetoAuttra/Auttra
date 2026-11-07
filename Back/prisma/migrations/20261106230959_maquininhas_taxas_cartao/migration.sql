-- Maquininhas de cartão com taxas e prazos da operadora, e a taxa gravada em cada recebimento no cartão.

-- "cartao" fica como valor legado: os registros antigos continuam com ele (não dá para saber se foi crédito ou débito).

ALTER TYPE "metodo_pagamento" ADD VALUE 'cartao_credito';
ALTER TYPE "metodo_pagamento" ADD VALUE 'cartao_debito';

-- AlterTable
ALTER TABLE "pagamento" ADD COLUMN     "cartao_parcelas" INTEGER,
ADD COLUMN     "data_prevista_recebimento" DATE,
ADD COLUMN     "maquininha_id" INTEGER,
ADD COLUMN     "taxa_percentual" DECIMAL(5,2),
ADD COLUMN     "valor_taxa" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "pagamento_movimento" ADD COLUMN     "cartao_parcelas" INTEGER,
ADD COLUMN     "data_prevista_recebimento" DATE,
ADD COLUMN     "maquininha_id" INTEGER,
ADD COLUMN     "taxa_percentual" DECIMAL(5,2),
ADD COLUMN     "valor_taxa" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "maquininha" (
    "id" SERIAL NOT NULL,
    "oficina_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "operadora" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "aceita_debito" BOOLEAN NOT NULL DEFAULT true,
    "aceita_credito" BOOLEAN NOT NULL DEFAULT true,
    "taxa_debito" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "prazo_debito_dias" INTEGER NOT NULL DEFAULT 1,
    "taxas_credito" JSONB NOT NULL DEFAULT '[0]',
    "prazo_credito_dias" INTEGER NOT NULL DEFAULT 30,
    "intervalo_parcelas_dias" INTEGER NOT NULL DEFAULT 30,
    "antecipacao" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "maquininha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maquininha_oficina_id_deleted_at_idx" ON "maquininha"("oficina_id", "deleted_at");

-- CreateIndex
CREATE INDEX "pagamento_maquininha_id_idx" ON "pagamento"("maquininha_id");

-- CreateIndex
CREATE INDEX "pagamento_movimento_maquininha_id_idx" ON "pagamento_movimento"("maquininha_id");

-- AddForeignKey
ALTER TABLE "pagamento" ADD CONSTRAINT "pagamento_maquininha_id_fkey" FOREIGN KEY ("maquininha_id") REFERENCES "maquininha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento_movimento" ADD CONSTRAINT "pagamento_movimento_maquininha_id_fkey" FOREIGN KEY ("maquininha_id") REFERENCES "maquininha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maquininha" ADD CONSTRAINT "maquininha_oficina_id_fkey" FOREIGN KEY ("oficina_id") REFERENCES "oficina"("id") ON DELETE CASCADE ON UPDATE CASCADE;
