-- Busca por texto (contains + insensitive vira ILIKE '%termo%'): indices trigram nas colunas buscadas.
-- pg_trgm vem no contrib do Postgres (Railway e a imagem oficial ja trazem).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Indices de coluna unica com baixa seletividade (deleted_at quase sempre NULL, status com 3-4 valores)
-- ou cobertos por um composto que comeca pela mesma coluna. Nao ajudam as consultas e custam em toda escrita.
-- Mantidos: oficina.deleted_at (filtro de oficinas inativas no admin) e ordem_servico.status (metricas do admin).
DROP INDEX "agendamento_deleted_at_idx";
DROP INDEX "agendamento_oficina_id_idx";
DROP INDEX "agendamento_status_idx";
DROP INDEX "cliente_deleted_at_idx";
DROP INDEX "cliente_oficina_id_idx";
DROP INDEX "cliente_status_idx";
DROP INDEX "compra_peca_deleted_at_idx";
DROP INDEX "estoque_deleted_at_idx";
DROP INDEX "fornecedor_deleted_at_idx";
DROP INDEX "funcionario_cargo_idx";
DROP INDEX "funcionario_deleted_at_idx";
DROP INDEX "item_orcamento_deleted_at_idx";
DROP INDEX "item_ordem_servico_deleted_at_idx";
DROP INDEX "orcamento_cliente_id_idx";
DROP INDEX "orcamento_deleted_at_idx";
DROP INDEX "orcamento_status_idx";
DROP INDEX "ordem_servico_deleted_at_idx";
DROP INDEX "ordem_servico_oficina_id_idx";
DROP INDEX "pagamento_deleted_at_idx";
DROP INDEX "pagamento_oficina_id_idx";
DROP INDEX "pagamento_status_idx";
DROP INDEX "peca_deleted_at_idx";
DROP INDEX "perfil_acesso_deleted_at_idx";
DROP INDEX "servico_deleted_at_idx";
DROP INDEX "usuario_deleted_at_idx";
DROP INDEX "usuario_status_idx";
DROP INDEX "usuario_oficina_deleted_at_idx";
DROP INDEX "usuario_oficina_status_idx";
DROP INDEX "veiculo_deleted_at_idx";

CREATE INDEX "cliente_nome_trgm_idx" ON "cliente" USING GIN ("nome" gin_trgm_ops);
CREATE INDEX "cliente_email_trgm_idx" ON "cliente" USING GIN ("email" gin_trgm_ops);
CREATE INDEX "cliente_telefone_trgm_idx" ON "cliente" USING GIN ("telefone" gin_trgm_ops);
CREATE INDEX "cliente_cpf_trgm_idx" ON "cliente" USING GIN ("cpf" gin_trgm_ops);
CREATE INDEX "funcionario_nome_trgm_idx" ON "funcionario" USING GIN ("nome" gin_trgm_ops);
CREATE INDEX "peca_nome_trgm_idx" ON "peca" USING GIN ("nome" gin_trgm_ops);
CREATE INDEX "peca_descricao_trgm_idx" ON "peca" USING GIN ("descricao" gin_trgm_ops);
CREATE INDEX "servico_nome_trgm_idx" ON "servico" USING GIN ("nome" gin_trgm_ops);
CREATE INDEX "servico_categoria_trgm_idx" ON "servico" USING GIN ("categoria" gin_trgm_ops);
CREATE INDEX "veiculo_placa_trgm_idx" ON "veiculo" USING GIN ("placa" gin_trgm_ops);
CREATE INDEX "veiculo_modelo_trgm_idx" ON "veiculo" USING GIN ("modelo" gin_trgm_ops);
