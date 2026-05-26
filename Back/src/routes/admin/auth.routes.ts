import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AdminAuthController } from "../../controllers/admin/auth.controller.js";
import { requireSistema } from "../../middlewares/requireSistema.js";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Muitas tentativas de login. Aguarde 15 minutos." },
});

const router = Router();

router.post("/login", loginLimiter, AdminAuthController.login);
router.post("/2fa/verify", loginLimiter, AdminAuthController.verify2fa);

// rotas abaixo exigem token completo
router.get("/me", requireSistema, AdminAuthController.me);
router.post("/2fa/setup", requireSistema, AdminAuthController.setup2fa);
router.post("/2fa/confirm", requireSistema, AdminAuthController.confirm2fa);
router.delete("/2fa", requireSistema, AdminAuthController.disable2fa);

export default router;
