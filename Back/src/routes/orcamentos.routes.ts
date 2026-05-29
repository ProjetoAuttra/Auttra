import { Router } from "express";
import { OrcamentoController } from "../controllers/orcamentos.controller.js";
import crypto from "crypto";
import { shortLinks } from "../services/shortLinks.js";

const router = Router();
const controller = new OrcamentoController();

router.get("/", controller.listar);
router.get("/:id/pdf", controller.gerarPdf);
router.get("/:id", controller.buscar);
router.post("/", controller.criar);
router.put("/:id", controller.atualizar);
router.patch("/:id/status", controller.atualizarStatus);
router.delete("/:id", controller.excluir);

router.post("/:id/share", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const token = req.query.token ?? req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(400).json({ error: "Token é obrigatório para compartilhar." });
    }
    
    let code = "";
    for (const [k, v] of shortLinks.entries()) {
      if (v.orcamentoId === id && v.token === token) {
        code = k;
        break;
      }
    }
    
    if (!code) {
      code = crypto.randomBytes(3).toString("hex").toUpperCase();
      shortLinks.set(code, { orcamentoId: id, token: String(token) });
    }
    
    res.json({ code });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
