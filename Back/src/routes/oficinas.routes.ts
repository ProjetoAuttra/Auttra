import { Router } from "express";
import { OficinaController } from "../controllers/oficinas.controller.js";

const router = Router();

router.post("/", OficinaController.create);
router.get("/", OficinaController.list);
router.get("/minha", OficinaController.getMyOficina);
router.patch("/minha", OficinaController.updateMyOficina);

export default router;
