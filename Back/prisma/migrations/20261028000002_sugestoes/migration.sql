-- Sugestoes enviadas pelos clientes no app, exibidas no cadastro da oficina no painel admin.
CREATE TYPE "modulo_sugestao" AS ENUM ('inicio', 'agenda', 'clientes', 'veiculos', 'orcamentos', 'ordens', 'financeiro', 'estoque', 'relatorios', 'configuracoes', 'outros');

CREATE TABLE "sugestao" (
    "id" SERIAL NOT NULL,
    "oficina_id" INTEGER NOT NULL,
    "usuario_id" INTEGER,
    "modulo" "modulo_sugestao" NOT NULL,
    "mensagem" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sugestao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sugestao_oficina_id_created_at_idx" ON "sugestao"("oficina_id", "created_at");

ALTER TABLE "sugestao" ADD CONSTRAINT "sugestao_oficina_id_fkey" FOREIGN KEY ("oficina_id") REFERENCES "oficina"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sugestao" ADD CONSTRAINT "sugestao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
