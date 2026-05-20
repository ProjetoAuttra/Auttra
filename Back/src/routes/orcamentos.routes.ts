import { Router } from "express";
import { OrcamentoController } from "../controllers/orcamentos.controller.js";

const router = Router();
const controller = new OrcamentoController();

router.get("/", controller.listar);
router.get("/:id/pdf", controller.gerarPdf);
router.get("/:id", controller.buscar);
router.post("/", controller.criar);
router.put("/:id", controller.atualizar);
router.patch("/:id/status", controller.atualizarStatus);
router.delete("/:id", controller.excluir);

export default router;
