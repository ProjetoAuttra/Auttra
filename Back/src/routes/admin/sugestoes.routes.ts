import { Router } from "express";
import { SugestoesAdminController } from "../../controllers/admin/sugestoes.controller.js";

const router = Router();

router.get("/", SugestoesAdminController.listar);

export default router;
