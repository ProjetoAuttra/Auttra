import { Router } from "express";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { idsDe, periodoDe, RelatoriosService } from "../services/relatorios.service.js";
import { sendServiceError } from "../utils/httpError.js";

const router = Router();

router.get("/inadimplencia", async (req, res) => {
  try {
    res.json(await RelatoriosService.inadimplencia(getRequiredOfficeId(req), idsDe(req.query.cliente_id)));
  } catch (err) {
    sendServiceError(res, err, "relatorios/inadimplencia");
  }
});

router.get("/faturamento", async (req, res) => {
  try {
    res.json(await RelatoriosService.faturamento(getRequiredOfficeId(req), periodoDe(req.query.from, req.query.to), {
        mecanicos: idsDe(req.query.mecanico_id),
        clientes: idsDe(req.query.cliente_id),
      }));
  } catch (err) {
    sendServiceError(res, err, "relatorios/faturamento");
  }
});

router.get("/mecanicos", async (req, res) => {
  try {
    res.json(await RelatoriosService.mecanicos(getRequiredOfficeId(req), periodoDe(req.query.from, req.query.to)));
  } catch (err) {
    sendServiceError(res, err, "relatorios/mecanicos");
  }
});

router.get("/resultado", async (req, res) => {
  try {
    res.json(await RelatoriosService.resultado(getRequiredOfficeId(req), periodoDe(req.query.from, req.query.to)));
  } catch (err) {
    sendServiceError(res, err, "relatorios/resultado");
  }
});

export default router;
