import rateLimit from "express-rate-limit";

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: "Muitas solicitacoes de recuperacao de senha. Tente novamente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Muitas tentativas. Aguarde 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const publicLinkLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Muitas requisicoes. Aguarde um minuto." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Cadastro pelo site: até 5 contas criadas por hora por IP (tentativa recusada não conta)...
export const cadastroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  skipFailedRequests: true,
  message: { message: "Muitos cadastros feitos desta rede. Tente de novo em uma hora.", code: "LIMITE_CADASTRO" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ...e até 30 tentativas por hora, para ninguém ficar testando e-mails ou forçando o formulário.
export const cadastroTentativasLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { message: "Muitas tentativas de cadastro. Tente de novo em uma hora.", code: "LIMITE_CADASTRO" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Reenvio do link de confirmação de e-mail (logado).
export const reenvioConfirmacaoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: "Você já pediu vários links. Confira sua caixa de entrada e o spam, ou tente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});
