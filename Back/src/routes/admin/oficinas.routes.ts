import { Router } from "express";
import { OficinasAdminController } from "../../controllers/admin/oficinas.controller.js";

const router = Router();

router.get("/", OficinasAdminController.listar);
router.post("/", OficinasAdminController.criar);
router.get("/:id", OficinasAdminController.getById);
router.patch("/:id", OficinasAdminController.update);
router.delete("/:id", OficinasAdminController.softDelete);
router.post("/:id/reativar", OficinasAdminController.reativar);

export default router;
