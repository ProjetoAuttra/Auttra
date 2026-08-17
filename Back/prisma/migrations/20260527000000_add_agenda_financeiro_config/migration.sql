ALTER TABLE "oficina"
ADD COLUMN "agenda_config" JSONB NOT NULL DEFAULT '{"horarioInicio":"08:00","horarioFim":"18:00","dias":"Segunda a Sábado","tempoMedio":"60 minutos"}',
ADD COLUMN "financeiro_config" JSONB NOT NULL DEFAULT '{"formasPagamento":"Pix, Cartão, Dinheiro","emitirRecibos":true,"jurosAtraso":"2%"}';
