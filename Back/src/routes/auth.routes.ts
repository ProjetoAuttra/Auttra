import { Router } from "express";
import {
  login,
  verifyEmail,
  selectOficina,
  changePassword,
  updateFoto,
  forgotPassword,
  resetPassword,
  cadastro,
  confirmarEmail,
  reenviarConfirmacao,
} from "../controllers/auth.controller.js";
import {
  cadastroLimiter,
  cadastroTentativasLimiter,
  passwordResetLimiter,
  reenvioConfirmacaoLimiter,
  resetPasswordLimiter,
} from "../middlewares/rateLimiters.js";
import { authMiddleware } from "../middlewares/ensureAuth.js";

const router = Router();

router.post("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/select-oficina", selectOficina);
router.post("/forgot-password", passwordResetLimiter, forgotPassword);
router.post("/reset-password", resetPasswordLimiter, resetPassword);
router.post("/cadastro", cadastroTentativasLimiter, cadastroLimiter, cadastro);
router.post("/confirmar-email", resetPasswordLimiter, confirmarEmail);
router.post("/reenviar-confirmacao", authMiddleware, reenvioConfirmacaoLimiter, reenviarConfirmacao);
router.post("/change-password", authMiddleware, changePassword);
router.patch("/me/foto", authMiddleware, updateFoto);

export default router;
