-- "Recursos adicionais" passa a se chamar "Recursos do sistema".

-- Coluna com os módulos ligados/desligados de cada oficina.
ALTER TABLE "oficina" RENAME COLUMN "recursos_adicionais" TO "recursos_sistema";

-- Chave do módulo dentro das permissões de cada perfil de acesso.
-- Se o perfil já tiver as duas chaves, a nova prevalece.
UPDATE "perfil_acesso"
SET "permissoes" = ("permissoes" - 'recursos_adicionais')
  || jsonb_build_object('recursos_sistema', COALESCE("permissoes" -> 'recursos_sistema', "permissoes" -> 'recursos_adicionais'))
WHERE "permissoes" ? 'recursos_adicionais';
