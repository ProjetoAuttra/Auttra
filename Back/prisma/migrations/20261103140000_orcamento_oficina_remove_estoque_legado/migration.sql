-- Orcamento passa a ter oficina_id proprio, como as demais tabelas da oficina. Antes o isolamento
-- dependia de cada consulta filtrar por cliente.oficina_id (join em toda listagem e risco de vazar
-- orcamento entre oficinas se um filtro fosse esquecido).
ALTER TABLE "orcamento" ADD COLUMN "oficina_id" INTEGER;

UPDATE "orcamento" o
SET "oficina_id" = c."oficina_id"
FROM "cliente" c
WHERE c."id" = o."cliente_id";

ALTER TABLE "orcamento" ALTER COLUMN "oficina_id" SET NOT NULL;

ALTER TABLE "orcamento" ADD CONSTRAINT "orcamento_oficina_id_fkey" FOREIGN KEY ("oficina_id") REFERENCES "oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "orcamento_oficina_id_deleted_at_id_idx" ON "orcamento"("oficina_id", "deleted_at", "id");

-- Tabela "estoque" era legado: o estoque real fica em peca.estoque e nenhum cliente chama /api/estoque.
-- Sem linhas, e removida. Se houver dados, e so renomeada para nao perder nada: confira e apague
-- "estoque_legado" a mao depois.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "estoque") THEN
    ALTER TABLE "estoque" RENAME TO "estoque_legado";
    ALTER TABLE "estoque_legado" DROP CONSTRAINT IF EXISTS "estoque_oficina_id_fkey";
  ELSE
    DROP TABLE "estoque";
  END IF;
END $$;
