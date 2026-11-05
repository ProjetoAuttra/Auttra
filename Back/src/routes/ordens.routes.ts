import { Router } from "express";
import { OrdensController } from "../controllers/ordens.controller.js";
import { PdfHtmlService } from "../services/pdfservice.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { LinksPublicosService } from "../services/linksPublicos.service.js";
import { FuncionariosService } from "../services/funcionarios.service.js";

const router = Router();

router.get("/", OrdensController.list);

// Quem pode ser responsavel pela OS: liberado pelo modulo de ordens, sem exigir o de funcionarios.
router.get("/responsaveis", async (req, res) => {
  res.json(await FuncionariosService.listarResponsaveis(getRequiredOfficeId(req)));
});

router.get("/:id/pdf", async (req, res) => {
  await PdfHtmlService.gerarOrdemServicoPDF(Number(req.params.id), res, getRequiredOfficeId(req));
});

router.get("/:id", OrdensController.getById);
router.post("/", OrdensController.create);
router.put("/:id", OrdensController.update);
router.delete("/:id", OrdensController.remove);

router.post("/:id/share", async (req, res) => {
  const code = await LinksPublicosService.obterOuCriar({ osId: Number(req.params.id) }, getRequiredOfficeId(req));
  res.json({ code });
});

router.delete("/:id/share", async (req, res) => {
  const canceled = await LinksPublicosService.cancelar({ osId: Number(req.params.id) }, getRequiredOfficeId(req));
  res.json({ canceled });
});

export default router;
