import { Router } from "express";
import { ConfiguracoesOperacionaisController } from "../controllers/configuracoesOperacionais.controller.js";
import { getRequiredOfficeId, requirePermission } from "../middlewares/ensureAuth.js";
import { MaquininhasService } from "../services/maquininhas.service.js";
import { canAccess } from "../permissions/accessProfiles.js";

const router = Router();

router.get("/agenda", requirePermission("configuracoes", "read"), ConfiguracoesOperacionaisController.getAgenda);
router.put("/agenda", requirePermission("configuracoes", "update"), ConfiguracoesOperacionaisController.updateAgenda);
router.get("/financeiro", requirePermission("configuracoes", "read"), ConfiguracoesOperacionaisController.getFinanceiro);
router.put("/financeiro", requirePermission("configuracoes", "update"), ConfiguracoesOperacionaisController.updateFinanceiro);
// Leitura liberada para qualquer usuário da oficina: o novo orçamento usa a validade padrão daqui.
router.get("/documentos", ConfiguracoesOperacionaisController.getDocumentos);
router.put("/documentos", requirePermission("configuracoes", "update"), ConfiguracoesOperacionaisController.updateDocumentos);

// Maquininhas de cartão. A lista das ativas é liberada para qualquer usuário da oficina: quem recebe
// no cartão escolhe a maquininha. Ver as inativas e alterar exige as permissões de configurações.
router.get("/maquininhas", async (req, res) => {
  const todas = req.query.todas === "true" && canAccess(req.user?.permissoes, "configuracoes", "read");
  res.json(await MaquininhasService.list(getRequiredOfficeId(req), todas));
});
router.post("/maquininhas", requirePermission("configuracoes", "update"), async (req, res) => {
  res.status(201).json(await MaquininhasService.create(getRequiredOfficeId(req), req.body));
});
router.put("/maquininhas/:id", requirePermission("configuracoes", "update"), async (req, res) => {
  res.json(await MaquininhasService.update(Number(req.params.id), getRequiredOfficeId(req), req.body));
});
router.delete("/maquininhas/:id", requirePermission("configuracoes", "update"), async (req, res) => {
  await MaquininhasService.delete(Number(req.params.id), getRequiredOfficeId(req));
  res.status(204).send();
});

export default router;
