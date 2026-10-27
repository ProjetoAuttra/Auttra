-- Marca na descricao os titulos de saldo gerados pela conversao dos parciais antigos.
UPDATE "pagamento"
SET "descricao" = CASE
      WHEN COALESCE(BTRIM("descricao"), '') = '' THEN
        CASE WHEN "tipo" = 'receber' THEN 'Saldo do recebimento parcial' ELSE 'Saldo do pagamento parcial' END
      WHEN "tipo" = 'receber' THEN "descricao" || ' (saldo do recebimento parcial)'
      ELSE "descricao" || ' (saldo do pagamento parcial)'
    END,
    "updated_at" = NOW()
WHERE "pagamento_pai_id" IS NOT NULL
  AND "observacao" LIKE 'Saldo do título #%'
  AND COALESCE("descricao", '') NOT LIKE '%(saldo do % parcial)'
  AND COALESCE("descricao", '') NOT LIKE 'Saldo do % parcial';
