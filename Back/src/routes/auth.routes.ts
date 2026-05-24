import { Router } from "express";
import {
  login,
  selectOficina,
  changePassword,
  updateFoto,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/ensureAuth.js";

const router = Router();

router.post("/login", login);
router.post("/select-oficina", selectOficina);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", authMiddleware, changePassword);
router.patch("/me/foto", authMiddleware, updateFoto);

export default router;
