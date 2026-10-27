import { Router } from "express";
import { OrdensController } from "../controllers/ordens.controller.js";
import { PdfHtmlService } from "../services/pdfservice.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { LinksPublicosService } from "../services/linksPublicos.service.js";

const router = Router();

router.get("/", OrdensController.list);

router.get("/:id/pdf", async (req, res) => {
  try {
    await PdfHtmlService.gerarOrdemServicoPDF(Number(req.params.id), res, getRequiredOfficeId(req));
  } catch (err: any) {
    console.error("Erro ao gerar PDF:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", OrdensController.getById);
router.post("/", OrdensController.create);
router.put("/:id", OrdensController.update);
router.delete("/:id", OrdensController.remove);

router.post("/:id/share", async (req, res) => {
  try {
    const code = await LinksPublicosService.obterOuCriar({ osId: Number(req.params.id) }, getRequiredOfficeId(req));
    res.json({ code });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id/share", async (req, res) => {
  try {
    const canceled = await LinksPublicosService.cancelar({ osId: Number(req.params.id) }, getRequiredOfficeId(req));
    res.json({ canceled });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
