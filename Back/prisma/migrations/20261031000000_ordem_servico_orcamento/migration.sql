-- Vincula a OS ao orçamento que a originou.
ALTER TABLE "ordem_servico" ADD COLUMN "orcamento_id" INTEGER;

CREATE INDEX "ordem_servico_orcamento_id_idx" ON "ordem_servico"("orcamento_id");

ALTER TABLE "ordem_servico" ADD CONSTRAINT "ordem_servico_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
