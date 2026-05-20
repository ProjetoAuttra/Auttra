-- CreateTable
CREATE TABLE "item_orcamento" (
    "id" SERIAL NOT NULL,
    "orcamento_id" INTEGER NOT NULL,
    "tipo_item" "tipo_item_os" NOT NULL,
    "servico_id" INTEGER,
    "peca_id" INTEGER,
    "nome" TEXT,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "preco_unitario" DECIMAL(65,30) NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "item_orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_orcamento_orcamento_id_idx" ON "item_orcamento"("orcamento_id");

-- CreateIndex
CREATE INDEX "item_orcamento_deleted_at_idx" ON "item_orcamento"("deleted_at");

-- AddForeignKey
ALTER TABLE "item_orcamento" ADD CONSTRAINT "item_orcamento_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_orcamento" ADD CONSTRAINT "item_orcamento_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_orcamento" ADD CONSTRAINT "item_orcamento_peca_id_fkey" FOREIGN KEY ("peca_id") REFERENCES "peca"("id") ON DELETE SET NULL ON UPDATE CASCADE;
