-- 1. metodo vira nullable (método definido só na confirmação do pagamento)
ALTER TABLE "pagamento" ALTER COLUMN "metodo" DROP NOT NULL;

-- 2. novos campos
ALTER TABLE "pagamento" ADD COLUMN IF NOT EXISTS "valor_original"           DECIMAL(65,30);
ALTER TABLE "pagamento" ADD COLUMN IF NOT EXISTS "desconto"                 DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "pagamento" ADD COLUMN IF NOT EXISTS "motivo_desconto"          TEXT;
ALTER TABLE "pagamento" ADD COLUMN IF NOT EXISTS "data_vencimento_original" TIMESTAMP(3);
ALTER TABLE "pagamento" ADD COLUMN IF NOT EXISTS "vezes_renegociado"        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pagamento" ADD COLUMN IF NOT EXISTS "valor_pago"               DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "pagamento" ADD COLUMN IF NOT EXISTS "parcela_numero"           INTEGER;
ALTER TABLE "pagamento" ADD COLUMN IF NOT EXISTS "total_parcelas"           INTEGER;
ALTER TABLE "pagamento" ADD COLUMN IF NOT EXISTS "pagamento_pai_id"         INTEGER;

-- 3. backfill dos campos obrigatórios nos registros existentes
UPDATE "pagamento" SET "valor_original" = "valor" WHERE "valor_original" IS NULL;
UPDATE "pagamento" SET "data_vencimento_original" = "data_vencimento" WHERE "data_vencimento_original" IS NULL;

-- 4. valor_original vira NOT NULL após o backfill
ALTER TABLE "pagamento" ALTER COLUMN "valor_original" SET NOT NULL;

-- 5. FK self-reference para parcelamento
ALTER TABLE "pagamento"
  ADD CONSTRAINT "pagamento_pagamento_pai_id_fkey"
  FOREIGN KEY ("pagamento_pai_id") REFERENCES "pagamento"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. index para consultas de parcelas
CREATE INDEX IF NOT EXISTS "pagamento_pagamento_pai_id_idx" ON "pagamento"("pagamento_pai_id");

-- 7. novo valor no enum status_pagamento
ALTER TYPE "status_pagamento" ADD VALUE IF NOT EXISTS 'parcial';
