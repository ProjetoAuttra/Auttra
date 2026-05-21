import { Router } from "express";
import { login, selectOficina, changePassword } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/ensureAuth.js";

const router = Router();

router.post("/login", login);
router.post("/select-oficina", selectOficina);
router.post("/change-password", authMiddleware, changePassword);

export default router;
