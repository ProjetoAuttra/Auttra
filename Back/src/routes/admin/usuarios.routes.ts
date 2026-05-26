import { Router } from "express";
import { UsuariosAdminController } from "../../controllers/admin/usuarios.controller.js";

const router = Router();

router.get("/", UsuariosAdminController.listar);
router.patch("/:id/email", UsuariosAdminController.updateEmail);
router.post("/:id/reset-senha", UsuariosAdminController.resetSenha);

export default router;
