import { Router } from "express";
import { OrdensController } from "../controllers/ordens.controller.js";
import { PdfHtmlService } from "../services/pdfservice.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { sendServiceError } from "../utils/httpError.js";
import { LinksPublicosService } from "../services/linksPublicos.service.js";
import { FuncionariosService } from "../services/funcionarios.service.js";

const router = Router();

router.get("/", OrdensController.list);

// Quem pode ser responsavel pela OS: liberado pelo modulo de ordens, sem exigir o de funcionarios.
router.get("/responsaveis", async (req, res) => {
  try {
    res.json(await FuncionariosService.listarResponsaveis(getRequiredOfficeId(req)));
  } catch (err) {
    sendServiceError(res, err, "ordens/responsaveis");
  }
});

router.get("/:id/pdf", async (req, res) => {
  try {
    await PdfHtmlService.gerarOrdemServicoPDF(Number(req.params.id), res, getRequiredOfficeId(req));
  } catch (err) {
    sendServiceError(res, err, "ordens/pdf");
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
  } catch (err) {
    sendServiceError(res, err, "ordens/share");
  }
});

router.delete("/:id/share", async (req, res) => {
  try {
    const canceled = await LinksPublicosService.cancelar({ osId: Number(req.params.id) }, getRequiredOfficeId(req));
    res.json({ canceled });
  } catch (err) {
    sendServiceError(res, err, "ordens/share");
  }
});

export default router;
