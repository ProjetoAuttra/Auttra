-- CreateTable
CREATE TABLE "nota_fiscal_importada" (
    "id" SERIAL NOT NULL,
    "oficina_id" INTEGER NOT NULL,
    "chave_acesso" TEXT NOT NULL,
    "numero_nota" TEXT,
    "serie" TEXT,
    "fornecedor_id" INTEGER,
    "valor_total" DECIMAL(65,30),
    "data_emissao" TIMESTAMP(3),
    "nome_arquivo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nota_fiscal_importada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nota_fiscal_importada_oficina_id_idx" ON "nota_fiscal_importada"("oficina_id");

-- CreateIndex
CREATE UNIQUE INDEX "nota_fiscal_importada_oficina_id_chave_acesso_key" ON "nota_fiscal_importada"("oficina_id", "chave_acesso");

-- AddForeignKey
ALTER TABLE "nota_fiscal_importada" ADD CONSTRAINT "nota_fiscal_importada_oficina_id_fkey" FOREIGN KEY ("oficina_id") REFERENCES "oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_fiscal_importada" ADD CONSTRAINT "nota_fiscal_importada_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
