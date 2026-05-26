import { Router } from "express";
import { MetricasAdminController } from "../../controllers/admin/metricas.controller.js";

const router = Router();

router.get("/", MetricasAdminController.get);

export default router;
