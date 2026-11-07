-- Recebíveis: o que cai na conta de cada recebimento no cartão, uma linha por parcela, já líquido da taxa.

-- CreateTable
CREATE TABLE "recebivel" (
    "id" SERIAL NOT NULL,
    "oficina_id" INTEGER NOT NULL,
    "pagamento_id" INTEGER NOT NULL,
    "movimento_id" INTEGER NOT NULL,
    "maquininha_id" INTEGER,
    "parcela" INTEGER NOT NULL,
    "total_parcelas" INTEGER NOT NULL,
    "valor_bruto" DECIMAL(12,2) NOT NULL,
    "valor_taxa" DECIMAL(12,2) NOT NULL,
    "valor_liquido" DECIMAL(12,2) NOT NULL,
    "data_prevista" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recebivel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recebivel_oficina_id_data_prevista_idx" ON "recebivel"("oficina_id", "data_prevista");

-- CreateIndex
CREATE INDEX "recebivel_pagamento_id_idx" ON "recebivel"("pagamento_id");

-- CreateIndex
CREATE INDEX "recebivel_movimento_id_idx" ON "recebivel"("movimento_id");

-- AddForeignKey
ALTER TABLE "recebivel" ADD CONSTRAINT "recebivel_oficina_id_fkey" FOREIGN KEY ("oficina_id") REFERENCES "oficina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recebivel" ADD CONSTRAINT "recebivel_pagamento_id_fkey" FOREIGN KEY ("pagamento_id") REFERENCES "pagamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recebivel" ADD CONSTRAINT "recebivel_movimento_id_fkey" FOREIGN KEY ("movimento_id") REFERENCES "pagamento_movimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recebivel" ADD CONSTRAINT "recebivel_maquininha_id_fkey" FOREIGN KEY ("maquininha_id") REFERENCES "maquininha"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Recebimentos no cartão feitos antes desta migração (pagamentos com maquininha ainda não estornados):
-- gera as parcelas com a configuração atual da maquininha. A última parcela cai na data prevista gravada
-- no movimento; as anteriores voltam o intervalo entre parcelas. Centavos que sobram ficam na última.
INSERT INTO "recebivel" ("oficina_id", "pagamento_id", "movimento_id", "maquininha_id", "parcela", "total_parcelas",
                         "valor_bruto", "valor_taxa", "valor_liquido", "data_prevista")
SELECT m."oficina_id", m."pagamento_id", m."id", m."maquininha_id", g.i, b.n,
       b.bruto_i, b.taxa_i, b.bruto_i - b.taxa_i,
       m."data_prevista_recebimento" - (q."intervalo_parcelas_dias" * (b.n - g.i))
FROM "pagamento_movimento" m
JOIN "maquininha" q ON q."id" = m."maquininha_id"
CROSS JOIN LATERAL (
  SELECT CASE WHEN m."metodo" = 'cartao_credito' AND NOT q."antecipacao" THEN GREATEST(COALESCE(m."cartao_parcelas", 1), 1) ELSE 1 END AS n
) t
CROSS JOIN LATERAL generate_series(1, t.n) AS g(i)
CROSS JOIN LATERAL (
  SELECT t.n AS n,
         CASE WHEN g.i = t.n THEN m."valor" - FLOOR(m."valor" * 100 / t.n) / 100 * (t.n - 1) ELSE FLOOR(m."valor" * 100 / t.n) / 100 END AS bruto_i,
         CASE WHEN g.i = t.n THEN m."valor_taxa" - FLOOR(m."valor_taxa" * 100 / t.n) / 100 * (t.n - 1) ELSE FLOOR(m."valor_taxa" * 100 / t.n) / 100 END AS taxa_i
) b
WHERE m."tipo" = 'pagamento'
  AND m."data_prevista_recebimento" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "pagamento_movimento" e WHERE e."estorno_de_id" = m."id");
