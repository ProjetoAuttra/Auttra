CREATE INDEX "ordem_servico_oficina_id_deleted_at_created_at_idx" ON "ordem_servico"("oficina_id", "deleted_at", "created_at");
CREATE INDEX "pagamento_oficina_id_deleted_at_data_vencimento_idx" ON "pagamento"("oficina_id", "deleted_at", "data_vencimento");
CREATE INDEX "cliente_oficina_id_deleted_at_nome_idx" ON "cliente"("oficina_id", "deleted_at", "nome");
CREATE INDEX "orcamento_cliente_id_deleted_at_id_idx" ON "orcamento"("cliente_id", "deleted_at", "id");
CREATE INDEX "agendamento_oficina_id_deleted_at_data_inicio_idx" ON "agendamento"("oficina_id", "deleted_at", "data_inicio");
