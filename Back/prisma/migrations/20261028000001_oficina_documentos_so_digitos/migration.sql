-- O cadastro pelo painel admin gravava CNPJ, CEP e telefone com mascara; o app grava so digitos.
-- Normaliza o que ja existe para o mesmo formato.
UPDATE "oficina" SET "cep" = regexp_replace("cep", '\D', '', 'g') WHERE "cep" ~ '\D';
UPDATE "oficina" SET "telefone" = NULLIF(regexp_replace("telefone", '\D', '', 'g'), '') WHERE "telefone" ~ '\D';
UPDATE "oficina" SET "cnpj" = NULLIF(regexp_replace("cnpj", '\D', '', 'g'), '') WHERE "cnpj" ~ '\D';
