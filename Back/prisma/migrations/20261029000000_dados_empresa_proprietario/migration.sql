-- Dados da empresa (oficina) e do proprietario (usuario gestor), exibidos e editados so no painel admin.
ALTER TABLE "oficina" ADD COLUMN "razao_social" TEXT;
ALTER TABLE "oficina" ADD COLUMN "inscricao_estadual" TEXT;
ALTER TABLE "oficina" ADD COLUMN "bairro" TEXT;
ALTER TABLE "oficina" ADD COLUMN "whatsapp" TEXT;

ALTER TABLE "usuario" ADD COLUMN "cpf" TEXT;
ALTER TABLE "usuario" ADD COLUMN "telefone" TEXT;
ALTER TABLE "usuario" ADD COLUMN "data_nascimento" DATE;
