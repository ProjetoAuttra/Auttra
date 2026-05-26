import { Router } from "express";
import { requireSistema } from "../../middlewares/requireSistema.js";
import adminAuthRouter from "./auth.routes.js";
import oficinasRouter from "./oficinas.routes.js";
import usuariosRouter from "./usuarios.routes.js";
import metricasRouter from "./metricas.routes.js";
import adminsRouter from "./admins.routes.js";

const adminRouter = Router();

adminRouter.use("/auth", adminAuthRouter);

// todas as rotas abaixo exigem token sistema
adminRouter.use(requireSistema);
adminRouter.use("/oficinas", oficinasRouter);
adminRouter.use("/usuarios", usuariosRouter);
adminRouter.use("/metricas", metricasRouter);
adminRouter.use("/admins", adminsRouter);

export default adminRouter;
