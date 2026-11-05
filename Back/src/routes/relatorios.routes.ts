import { Router } from "express";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { idsDe, periodoDe, RelatoriosService } from "../services/relatorios.service.js";

const router = Router();

router.get("/inadimplencia", async (req, res) => {
  res.json(await RelatoriosService.inadimplencia(getRequiredOfficeId(req), idsDe(req.query.cliente_id)));
});

router.get("/faturamento", async (req, res) => {
  res.json(await RelatoriosService.faturamento(getRequiredOfficeId(req), periodoDe(req.query.from, req.query.to), {
      mecanicos: idsDe(req.query.mecanico_id),
      clientes: idsDe(req.query.cliente_id),
    }));
});

router.get("/mecanicos", async (req, res) => {
  res.json(await RelatoriosService.mecanicos(getRequiredOfficeId(req), periodoDe(req.query.from, req.query.to)));
});

router.get("/resultado", async (req, res) => {
  res.json(await RelatoriosService.resultado(getRequiredOfficeId(req), periodoDe(req.query.from, req.query.to)));
});

export default router;
