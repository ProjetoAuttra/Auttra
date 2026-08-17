import { Router } from "express";
import clientesRouter from "./clientes.routes.js";
import funcionariosRouter from "./funcionarios.routes.js";
import oficinasRouter from "./oficinas.routes.js";
import veiculosRouter from "./veiculos.routes.js";
import fornecedoresRouter from "./fornecedores.routes.js";
import estoqueRouter from "./estoque.routes.js";
import authRouter from "./auth.routes.js";
import usuarioRouter from "./usuario.routes.js";
import cidadeRouter from "./cidade.routes.js";
import servicosRouter from "./servicos.routes.js";
import ordensRouter from "./ordens.routes.js";
import pecasRouter from "./pecas.routes.js";
import pagamentosRouter from "./pagamentos.routes.js";
import orcamentosRouter from "./orcamentos.routes.js";
import agendamentosRouter from "./agendamento.routes.js";
import perfisAcessoRouter from "./perfisAcesso.routes.js";
import recursosAdicionaisRouter from "./recursosAdicionais.routes.js";
import importacaoXmlRouter from "./importacaoXml.routes.js";
import notificacoesRouter from "./notificacoes.routes.js";
import configuracoesOperacionaisRouter from "./configuracoesOperacionais.routes.js";
import whatsappRouter from "./whatsapp.routes.js";
import { authMiddleware, officeScopeMiddleware, requirePermission } from "../middlewares/ensureAuth.js";
import type { AccessModule, AccessAction } from "../permissions/accessProfiles.js";
import adminRouter from "./admin/index.js";

import { shortLinks } from "../services/shortLinks.js";
import { PublicTrackingService } from "../services/publicTracking.service.js";

export const router = Router();

router.use("/admin", adminRouter);
router.use("/auth", authRouter);

const getFrontendUrl = (req: any) => {
  const configured = process.env.FRONTEND_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  return `${req.protocol}://${req.get("host")}`;
};

router.get("/s/:code", (req, res) => {
  const { code } = req.params;
  const data = shortLinks.get(code);
  if (!data) {
    return res.status(404).send("<h1>Link expirado ou inválido.</h1>");
  }
  return res.redirect(`${getFrontendUrl(req)}/acompanhamento/${code}`);
});

router.get("/s/:code/pdf", (req, res) => {
  const { code } = req.params;
  const data = shortLinks.get(code);
  if (!data) {
    return res.status(404).send("<h1>Link expirado ou inválido.</h1>");
  }
  if (data.orcamentoId) {
    return res.redirect(`/api/orcamentos/${data.orcamentoId}/pdf?token=${data.token}`);
  }
  res.redirect(`/api/ordens/${data.osId}/pdf?token=${data.token}`);
});

router.get("/public/acompanhamento/:code", async (req, res) => {
  const data = await PublicTrackingService.getByCode(req.params.code);
  if (!data) {
    return res.status(404).json({ error: "Link expirado ou inválido." });
  }
  res.json(data);
});

router.use(authMiddleware);
router.use(officeScopeMiddleware);

const actionByMethod: Record<string, AccessAction> = {
  GET: "read",
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
};

const modulePermission = (module: AccessModule) => (req: any, res: any, next: any) =>
  requirePermission(module, actionByMethod[req.method] ?? "read")(req, res, next);

router.use("/cidade", cidadeRouter);
router.use("/notificacoes", notificacoesRouter);
router.use("/configuracoes", configuracoesOperacionaisRouter);
router.use("/whatsapp", whatsappRouter);
router.use("/perfis-acesso", perfisAcessoRouter);
router.use("/recursos-adicionais", recursosAdicionaisRouter);
router.use("/oficinas", modulePermission("configuracoes"), oficinasRouter);
router.use("/clientes", modulePermission("clientes"), clientesRouter);
router.use("/funcionarios", modulePermission("funcionarios"), funcionariosRouter);
router.use("/veiculos", modulePermission("veiculos"), veiculosRouter);
router.use("/fornecedores", modulePermission("fornecedores"), fornecedoresRouter);
router.use("/estoque", modulePermission("estoque"), estoqueRouter);
router.use("/usuario", modulePermission("funcionarios"), usuarioRouter);
router.use("/servicos", modulePermission("servicos"), servicosRouter);
router.use("/ordens", modulePermission("ordens"), ordensRouter);
router.use("/pecas", modulePermission("estoque"), pecasRouter);
router.use("/pagamentos", modulePermission("financeiro"), pagamentosRouter);
router.use("/orcamentos", modulePermission("orcamentos"), orcamentosRouter);
router.use("/agendamentos", modulePermission("agenda"), agendamentosRouter);
router.use("/importarxml", modulePermission("estoque"), importacaoXmlRouter);

export default router;
