import { Router } from "express";
import { AdminsController } from "../../controllers/admin/admins.controller.js";

const router = Router();

router.get("/", AdminsController.listar);
router.post("/", AdminsController.criar);
router.patch("/:id", AdminsController.atualizar);
router.post("/:id/link-senha", AdminsController.linkSenha);
router.patch("/:id/desativar", AdminsController.desativar);
router.patch("/:id/reativar", AdminsController.reativar);

export default router;
