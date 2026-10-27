-- Recebimento/pagamento parcial deixa de existir como status: o titulo passa a valer o que foi pago
-- ("pago") e o saldo vira um novo titulo pendente com o mesmo vencimento. Converte os titulos "parcial" antigos.

-- 1) Novo titulo pendente com o saldo (ligado ao titulo de origem por pagamento_pai_id).
INSERT INTO "pagamento" (
  "cliente_id", "oficina_id", "ordem_servico_id", "fornecedor_id", "tipo", "metodo",
  "valor", "valor_original", "desconto", "status", "data_vencimento", "data_vencimento_original",
  "vezes_renegociado", "valor_pago", "categoria", "descricao", "observacao", "pagamento_pai_id",
  "created_at", "updated_at"
)
SELECT
  p."cliente_id", p."oficina_id", p."ordem_servico_id", p."fornecedor_id", p."tipo", p."metodo",
  (p."valor_original" - p."desconto" - p."valor_pago"),
  (p."valor_original" - p."desconto" - p."valor_pago"),
  0, 'pendente', p."data_vencimento", p."data_vencimento_original",
  p."vezes_renegociado", 0, p."categoria", p."descricao", 'Saldo do título #' || p."id", p."id",
  NOW(), NOW()
FROM "pagamento" p
WHERE p."status" = 'parcial' AND p."deleted_at" IS NULL;

-- 2) O titulo original passa a valer exatamente o que foi pago.
UPDATE "pagamento" p
SET "valor_original" = p."valor_pago" + p."desconto",
    "valor" = p."valor_pago" + p."desconto",
    "status" = 'pago',
    "data_pagamento" = COALESCE(
      p."data_pagamento",
      (SELECT MAX(m."created_at") FROM "pagamento_movimento" m WHERE m."pagamento_id" = p."id" AND m."tipo" = 'pagamento'),
      NOW()
    ),
    "updated_at" = NOW()
WHERE p."status" = 'parcial' AND p."deleted_at" IS NULL;
