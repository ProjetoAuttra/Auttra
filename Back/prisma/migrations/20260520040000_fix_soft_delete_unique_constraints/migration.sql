-- Drop the full unique constraint on veiculo(placa, oficina_id)
-- This constraint incorrectly blocks reusing a plate that belongs to a soft-deleted row.
DROP INDEX IF EXISTS "veiculo_placa_oficina_id_key";

-- Create a partial unique index: only enforce uniqueness among non-deleted rows.
-- Soft-deleted rows are excluded so a plate can be reused after a vehicle is deleted.
CREATE UNIQUE INDEX "veiculo_placa_oficina_active_unique"
  ON "veiculo" ("placa", "oficina_id")
  WHERE "deleted_at" IS NULL;
