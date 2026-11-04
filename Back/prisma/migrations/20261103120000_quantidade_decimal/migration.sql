-- Quantidade fracionada (ex.: 3,5 L de óleo) e unidade da peça.
-- Int converte para DECIMAL(12,3) sem perda; os defaults atuais (1 e 0) continuam válidos.
ALTER TABLE "item_ordem_servico" ALTER COLUMN "quantidade" TYPE DECIMAL(12,3);
ALTER TABLE "item_orcamento" ALTER COLUMN "quantidade" TYPE DECIMAL(12,3);
ALTER TABLE "peca" ALTER COLUMN "estoque" TYPE DECIMAL(12,3);
ALTER TABLE "compra_peca" ALTER COLUMN "quantidade" TYPE DECIMAL(12,3);

-- Valores aceitos (validados no back): UN, L, KG, M.
ALTER TABLE "peca" ADD COLUMN "unidade" TEXT NOT NULL DEFAULT 'UN';
