-- Multa no título: soma ao valor a receber/pagar (valor líquido = original - desconto + multa).
ALTER TABLE "pagamento" ADD COLUMN IF NOT EXISTS "multa" DECIMAL(65,30) NOT NULL DEFAULT 0;
