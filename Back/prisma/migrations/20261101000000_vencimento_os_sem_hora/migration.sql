-- Contas geradas por OS gravavam data e hora (UTC) no vencimento. Passa a ser só o dia em
-- São Paulo, à meia-noite UTC, como o formulário de contas grava. Uma OS concluída depois das
-- 21h de Brasília vencia no dia seguinte e não aparecia em "A receber hoje".
-- Cada coluna é corrigida à parte: a conta pode ter sido renegociada pelo formulário
-- (vencimento já sem hora) e manter o vencimento original com hora.

UPDATE "pagamento"
SET "data_vencimento" = ((("data_vencimento" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date)::timestamp
WHERE "ordem_servico_id" IS NOT NULL
  AND "data_vencimento"::time <> '00:00:00';

UPDATE "pagamento"
SET "data_vencimento_original" = ((("data_vencimento_original" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::date)::timestamp
WHERE "ordem_servico_id" IS NOT NULL
  AND "data_vencimento_original" IS NOT NULL
  AND "data_vencimento_original"::time <> '00:00:00';
