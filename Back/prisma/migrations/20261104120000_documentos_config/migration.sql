-- Configuração dos documentos (orçamento e OS): prazo de garantia, validade padrão do orçamento e observações.
ALTER TABLE "oficina"
ADD COLUMN "documentos_config" JSONB NOT NULL DEFAULT '{"garantiaDias":90,"validadeOrcamentoDias":7,"observacoes":""}';
