import { Router } from "express";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { PainelService } from "../services/painel.service.js";

const router = Router();

router.get("/resumo", async (req, res) => {
  res.json(await PainelService.resumo(getRequiredOfficeId(req), req.user?.permissoes));
});

export default router;
