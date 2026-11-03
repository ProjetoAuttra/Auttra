import { Router } from "express";
import { VeiculosController } from "../controllers/veiculos.controller.js";
import { CatalogoVeiculosService } from "../services/catalogoVeiculos.service.js";

const router = Router();

router.get("/catalogo", async (_req, res) => {
  try {
    res.json(await CatalogoVeiculosService.listar());
  } catch (err: any) {
    console.error("Erro ao listar catalogo de veiculos:", err);
    res.status(500).json({ error: "Não foi possível carregar o catálogo de veículos." });
  }
});
router.get("/", VeiculosController.list);
router.get("/:id", VeiculosController.getById);
router.post("/", VeiculosController.create);
router.put("/:id", VeiculosController.update);
router.delete("/:id", VeiculosController.remove);

export default router;
