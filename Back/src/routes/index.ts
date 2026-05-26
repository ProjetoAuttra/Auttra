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
import { authMiddleware, officeScopeMiddleware, requirePermission } from "../middlewares/ensureAuth.js";
import type { AccessModule, AccessAction } from "../permissions/accessProfiles.js";
import adminRouter from "./admin/index.js";

export const router = Router();

router.use("/admin", adminRouter);
router.use("/auth", authRouter);

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
