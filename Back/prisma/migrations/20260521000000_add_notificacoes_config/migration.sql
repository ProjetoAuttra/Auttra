ALTER TABLE "oficina"
ADD COLUMN "notificacoes_config" JSONB NOT NULL DEFAULT '{"agenda":{"ativo":true,"diasAntecedencia":1},"financeiro":{"ativo":true,"diasVencimento":3},"estoque":{"ativo":true,"limiteBaixo":3},"ordens":{"ativo":true,"diasParada":3,"diasCritico":7},"orcamentos":{"ativo":true,"diasPendente":2}}';
