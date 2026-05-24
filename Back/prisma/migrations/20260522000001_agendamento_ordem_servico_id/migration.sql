ALTER TABLE "agendamento" ADD COLUMN IF NOT EXISTS "ordem_servico_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'agendamento_ordem_servico_id_fkey'
  ) THEN
    ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_ordem_servico_id_fkey"
      FOREIGN KEY ("ordem_servico_id") REFERENCES "ordem_servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "agendamento_ordem_servico_id_idx" ON "agendamento"("ordem_servico_id");
