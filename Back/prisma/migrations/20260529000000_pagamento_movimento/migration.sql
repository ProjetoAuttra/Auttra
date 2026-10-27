CREATE TYPE "tipo_movimento_pagamento" AS ENUM ('pagamento', 'estorno');

CREATE TABLE "pagamento_movimento" (
  "id" SERIAL NOT NULL,
  "pagamento_id" INTEGER NOT NULL,
  "oficina_id" INTEGER NOT NULL,
  "tipo" "tipo_movimento_pagamento" NOT NULL,
  "valor" DECIMAL(65,30) NOT NULL,
  "metodo" "metodo_pagamento",
  "motivo" TEXT,
  "usuario_id" INTEGER,
  "estorno_de_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pagamento_movimento_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pagamento_movimento_valor_positivo_chk" CHECK ("valor" > 0)
);

CREATE INDEX "pagamento_movimento_pagamento_id_idx" ON "pagamento_movimento"("pagamento_id");
CREATE INDEX "pagamento_movimento_oficina_id_idx" ON "pagamento_movimento"("oficina_id");
CREATE INDEX "pagamento_movimento_estorno_de_id_idx" ON "pagamento_movimento"("estorno_de_id");

ALTER TABLE "pagamento_movimento" ADD CONSTRAINT "pagamento_movimento_pagamento_id_fkey"
  FOREIGN KEY ("pagamento_id") REFERENCES "pagamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pagamento_movimento" ADD CONSTRAINT "pagamento_movimento_oficina_id_fkey"
  FOREIGN KEY ("oficina_id") REFERENCES "oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pagamento_movimento" ADD CONSTRAINT "pagamento_movimento_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pagamento_movimento" ADD CONSTRAINT "pagamento_movimento_estorno_de_id_fkey"
  FOREIGN KEY ("estorno_de_id") REFERENCES "pagamento_movimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: cada titulo que ja tem valor pago ganha um movimento "pagamento" (sem usuario, data do titulo),
-- para que valor_pago continue igual a soma dos movimentos ativos.
INSERT INTO "pagamento_movimento" ("pagamento_id", "oficina_id", "tipo", "valor", "metodo", "created_at")
SELECT "id", "oficina_id", 'pagamento', "valor_pago", "metodo", COALESCE("data_pagamento", "updated_at")
FROM "pagamento"
WHERE "valor_pago" > 0;
