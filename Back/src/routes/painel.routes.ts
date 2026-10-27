import { Router } from "express";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { PainelService } from "../services/painel.service.js";
import { sendServiceError } from "../utils/httpError.js";

const router = Router();

router.get("/resumo", async (req, res) => {
  try {
    res.json(await PainelService.resumo(getRequiredOfficeId(req), req.user?.permissoes));
  } catch (err) {
    sendServiceError(res, err, "painel/resumo");
  }
});

export default router;
