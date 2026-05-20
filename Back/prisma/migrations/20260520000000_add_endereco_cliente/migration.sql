-- AlterTable: add address fields to cliente
ALTER TABLE "cliente" ADD COLUMN "cep" TEXT;
ALTER TABLE "cliente" ADD COLUMN "logradouro" TEXT;
ALTER TABLE "cliente" ADD COLUMN "numero" TEXT;
ALTER TABLE "cliente" ADD COLUMN "complemento" TEXT;
ALTER TABLE "cliente" ADD COLUMN "cidade_id" INTEGER;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_cidade_id_fkey" FOREIGN KEY ("cidade_id") REFERENCES "cidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "cliente_cidade_id_idx" ON "cliente"("cidade_id");
