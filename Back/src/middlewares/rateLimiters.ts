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
