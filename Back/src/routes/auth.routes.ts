import { Router } from "express";
import {
  login,
  verifyEmail,
  selectOficina,
  changePassword,
  updateFoto,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import { passwordResetLimiter, resetPasswordLimiter } from "../middlewares/rateLimiters.js";
import { authMiddleware } from "../middlewares/ensureAuth.js";

const router = Router();

router.post("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/select-oficina", selectOficina);
router.post("/forgot-password", passwordResetLimiter, forgotPassword);
router.post("/reset-password", resetPasswordLimiter, resetPassword);
router.post("/change-password", authMiddleware, changePassword);
router.patch("/me/foto", authMiddleware, updateFoto);

export default router;
