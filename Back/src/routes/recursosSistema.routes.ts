import { Router } from "express";
import { RecursosSistemaController } from "../controllers/recursosSistema.controller.js";
import { requirePermission } from "../middlewares/ensureAuth.js";

const router = Router();

router.get("/", RecursosSistemaController.get);
router.put("/", requirePermission("recursos_sistema", "update"), RecursosSistemaController.update);

export default router;
