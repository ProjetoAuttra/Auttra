import { Router } from "express";
import { OrcamentoController } from "../controllers/orcamentos.controller.js";
import { LinksPublicosService } from "../services/linksPublicos.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";

const router = Router();
const controller = new OrcamentoController();

router.get("/", controller.listar);
router.get("/:id/pdf", controller.gerarPdf);
router.get("/:id", controller.buscar);
router.post("/", controller.criar);
router.put("/:id", controller.atualizar);
router.patch("/:id/status", controller.atualizarStatus);
router.delete("/:id", controller.excluir);

router.post("/:id/share", async (req, res) => {
  try {
    const code = await LinksPublicosService.obterOuCriar({ orcamentoId: Number(req.params.id) }, getRequiredOfficeId(req));
    res.json({ code });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id/share", async (req, res) => {
  try {
    const canceled = await LinksPublicosService.cancelar({ orcamentoId: Number(req.params.id) }, getRequiredOfficeId(req));
    res.json({ canceled });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
