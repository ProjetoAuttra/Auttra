import { Router } from "express";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { AssinaturaService } from "../services/assinatura.service.js";

const router = Router();

// Qualquer usuário da oficina vê a situação: a faixa do topo aparece para todos.
router.get("/", async (req, res) => {
  const assinatura = await AssinaturaService.daOficina(getRequiredOfficeId(req));
  if (!assinatura) return res.status(404).json({ message: "Oficina não encontrada." });
  return res.json(assinatura);
});

export default router;
