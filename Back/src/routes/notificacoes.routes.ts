import { Router } from "express";
import { NotificacoesController } from "../controllers/notificacoes.controller.js";
import { requirePermission } from "../middlewares/ensureAuth.js";

const router = Router();

router.get("/", NotificacoesController.list);
router.get("/config", requirePermission("configuracoes", "read"), NotificacoesController.getConfig);
router.put("/config", requirePermission("configuracoes", "update"), NotificacoesController.updateConfig);

export default router;
