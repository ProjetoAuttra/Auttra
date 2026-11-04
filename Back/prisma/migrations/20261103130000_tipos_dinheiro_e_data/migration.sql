-- Tipos de coluna:
-- * Instantes passam a TIMESTAMPTZ. As colunas sem fuso ja guardavam UTC (Prisma), entao a conversao
--   interpreta o valor como UTC; o instante nao muda e o banco deixa de depender do fuso da sessao.
-- * Datas sem hora (vencimento, nascimento, contratacao) passam a DATE. O app grava meia-noite UTC do dia;
--   valores antigos com hora viram o dia em Sao Paulo (mesma regra de 20261101000000_vencimento_os_sem_hora).
-- * Dinheiro: valores com 2 casas; precos unitarios de peca/estoque/compra com 4 (NF-e traz mais de 2 casas).

ALTER TABLE "admin_audit_log" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "agendamento" ALTER COLUMN "data_inicio" SET DATA TYPE TIMESTAMPTZ(3) USING "data_inicio" AT TIME ZONE 'UTC',
  ALTER COLUMN "data_fim" SET DATA TYPE TIMESTAMPTZ(3) USING "data_fim" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "catalogo_veiculo" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "catalogo_veiculo_sync" ALTER COLUMN "ultima_em" SET DATA TYPE TIMESTAMPTZ(3) USING "ultima_em" AT TIME ZONE 'UTC';

ALTER TABLE "cidade" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "cliente" ALTER COLUMN "data_nascimento" SET DATA TYPE DATE USING CASE WHEN "data_nascimento"::time = '00:00:00' THEN "data_nascimento"::date ELSE ((("data_nascimento" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date) END,
  ALTER COLUMN "criado_em" SET DATA TYPE TIMESTAMPTZ(3) USING "criado_em" AT TIME ZONE 'UTC',
  ALTER COLUMN "atualizado_em" SET DATA TYPE TIMESTAMPTZ(3) USING "atualizado_em" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "compra_peca" ALTER COLUMN "preco_compra_unitario" SET DATA TYPE DECIMAL(14,4),
  ALTER COLUMN "data_compra" SET DATA TYPE TIMESTAMPTZ(3) USING "data_compra" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "estoque" ALTER COLUMN "preco_custo" SET DATA TYPE DECIMAL(14,4),
  ALTER COLUMN "preco_venda" SET DATA TYPE DECIMAL(14,4),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "fornecedor" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "funcionario" ALTER COLUMN "data_contratacao" SET DATA TYPE DATE USING CASE WHEN "data_contratacao"::time = '00:00:00' THEN "data_contratacao"::date ELSE ((("data_contratacao" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date) END,
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "item_orcamento" ALTER COLUMN "preco_unitario" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "item_ordem_servico" ALTER COLUMN "preco_unitario" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "link_publico" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "nota_fiscal_importada" ALTER COLUMN "valor_total" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "data_emissao" SET DATA TYPE TIMESTAMPTZ(3) USING "data_emissao" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "oficina" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "orcamento" ALTER COLUMN "valor" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "data" SET DATA TYPE TIMESTAMPTZ(3) USING "data" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "validade" SET DATA TYPE TIMESTAMPTZ(3) USING "validade" AT TIME ZONE 'UTC';

ALTER TABLE "ordem_servico" ALTER COLUMN "data_abertura" SET DATA TYPE TIMESTAMPTZ(3) USING "data_abertura" AT TIME ZONE 'UTC',
  ALTER COLUMN "data_fechamento" SET DATA TYPE TIMESTAMPTZ(3) USING "data_fechamento" AT TIME ZONE 'UTC',
  ALTER COLUMN "valor_total" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "pagamento" ALTER COLUMN "valor" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "data_vencimento" SET DATA TYPE DATE USING CASE WHEN "data_vencimento"::time = '00:00:00' THEN "data_vencimento"::date ELSE ((("data_vencimento" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date) END,
  ALTER COLUMN "data_pagamento" SET DATA TYPE TIMESTAMPTZ(3) USING "data_pagamento" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "valor_original" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "desconto" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "data_vencimento_original" SET DATA TYPE DATE USING CASE WHEN "data_vencimento_original"::time = '00:00:00' THEN "data_vencimento_original"::date ELSE ((("data_vencimento_original" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date) END,
  ALTER COLUMN "valor_pago" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "multa" SET DATA TYPE DECIMAL(12,2);

ALTER TABLE "pagamento_movimento" ALTER COLUMN "valor" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "password_reset_token" ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMPTZ(3) USING "expires_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "used_at" SET DATA TYPE TIMESTAMPTZ(3) USING "used_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "peca" ALTER COLUMN "preco_custo" SET DATA TYPE DECIMAL(14,4),
  ALTER COLUMN "preco_venda" SET DATA TYPE DECIMAL(14,4),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "perfil_acesso" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "servico" ALTER COLUMN "preco" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "sugestao" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "usuario" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "locked_until" SET DATA TYPE TIMESTAMPTZ(3) USING "locked_until" AT TIME ZONE 'UTC',
  ALTER COLUMN "last_login_at" SET DATA TYPE TIMESTAMPTZ(3) USING "last_login_at" AT TIME ZONE 'UTC';

ALTER TABLE "usuario_oficina" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "veiculo" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';
