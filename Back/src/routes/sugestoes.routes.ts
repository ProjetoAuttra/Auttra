import { Router } from "express";
import rateLimit from "express-rate-limit";
import { SugestoesController } from "../controllers/sugestoes.controller.js";

// Qualquer usuario da oficina pode sugerir (sem permissao de modulo); o limite evita envio em massa.
const sugestaoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { message: "Você enviou muitas sugestões em pouco tempo. Tente novamente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.post("/", sugestaoLimiter, SugestoesController.criar);

export default router;
