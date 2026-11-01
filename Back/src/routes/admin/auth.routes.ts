import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AdminAuthController } from "../../controllers/admin/auth.controller.js";
import { requireSistema } from "../../middlewares/requireSistema.js";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Muitas tentativas de login. Aguarde 15 minutos." },
});

// Ações que pedem senha ou código com a sessão já aberta: limite por usuário (não por IP),
// contando só as tentativas que falham. Quem tem uma sessão roubada não testa códigos à vontade.
const acaoSensivelLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `admin-usuario:${req.user!.id}`,
  message: { message: "Muitas tentativas inválidas. Aguarde 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.post("/login", loginLimiter, AdminAuthController.login);
router.post("/2fa/verify", loginLimiter, AdminAuthController.verify2fa);
router.post("/2fa/first-setup", loginLimiter, AdminAuthController.completeFirstSetup2fa);
router.post("/logout", AdminAuthController.logout);

// rotas abaixo exigem token completo
router.get("/me", requireSistema, AdminAuthController.me);
router.post("/senha", requireSistema, acaoSensivelLimiter, AdminAuthController.alterarSenha);
router.post("/2fa/setup", requireSistema, AdminAuthController.setup2fa);
router.post("/2fa/confirm", requireSistema, acaoSensivelLimiter, AdminAuthController.confirm2fa);
router.delete("/2fa", requireSistema, acaoSensivelLimiter, AdminAuthController.disable2fa);

export default router;
