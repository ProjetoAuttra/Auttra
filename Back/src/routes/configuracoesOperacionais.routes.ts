import { Router } from "express";
import { ConfiguracoesOperacionaisController } from "../controllers/configuracoesOperacionais.controller.js";
import { requirePermission } from "../middlewares/ensureAuth.js";

const router = Router();

router.get("/agenda", requirePermission("configuracoes", "read"), ConfiguracoesOperacionaisController.getAgenda);
router.put("/agenda", requirePermission("configuracoes", "update"), ConfiguracoesOperacionaisController.updateAgenda);
router.get("/financeiro", requirePermission("configuracoes", "read"), ConfiguracoesOperacionaisController.getFinanceiro);
router.put("/financeiro", requirePermission("configuracoes", "update"), ConfiguracoesOperacionaisController.updateFinanceiro);

export default router;
