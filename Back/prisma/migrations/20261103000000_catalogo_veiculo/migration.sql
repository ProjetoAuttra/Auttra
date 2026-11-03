-- Catálogo global de marcas e modelos para sugestão no cadastro de veículo.
CREATE TABLE "catalogo_veiculo" (
    "id" SERIAL NOT NULL,
    "chave" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'curado',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalogo_veiculo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "catalogo_veiculo_chave_key" ON "catalogo_veiculo"("chave");
CREATE INDEX "catalogo_veiculo_marca_idx" ON "catalogo_veiculo"("marca");

CREATE TABLE "catalogo_veiculo_sync" (
    "id" INTEGER NOT NULL,
    "ultima_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogo_veiculo_sync_pkey" PRIMARY KEY ("id")
);
