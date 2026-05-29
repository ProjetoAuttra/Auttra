import { Router } from "express";
import { OrdensService } from "../services/ordens.service.js";
import { PdfHtmlService } from "../services/pdfservice.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import crypto from "crypto";
import { shortLinks } from "../services/shortLinks.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const ordens = await OrdensService.list(getRequiredOfficeId(req));
    res.json(ordens);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const ordem = await OrdensService.getById(Number(req.params.id), getRequiredOfficeId(req));
    if (!ordem) return res.status(404).json({ error: "Ordem não encontrada" });
    res.json(ordem);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/pdf", async (req, res) => {
  try {
    await PdfHtmlService.gerarOrdemServicoPDF(Number(req.params.id), res, getRequiredOfficeId(req));
  } catch (err: any) {
    console.error("Erro ao gerar PDF:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const nova = await OrdensService.create({ ...req.body, oficina_id: getRequiredOfficeId(req) });
    res.status(201).json(nova);
  } catch (err: any) {
    console.error("Erro ao criar OS:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const atualizada = await OrdensService.update(
      Number(req.params.id),
      req.body,
      getRequiredOfficeId(req)
    );
    res.json(atualizada);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await OrdensService.delete(Number(req.params.id), getRequiredOfficeId(req));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/share", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const token = req.query.token ?? req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(400).json({ error: "Token é obrigatório para compartilhar." });
    }
    
    let code = "";
    for (const [k, v] of shortLinks.entries()) {
      if (v.osId === id && v.token === token) {
        code = k;
        break;
      }
    }
    
    if (!code) {
      code = crypto.randomBytes(3).toString("hex").toUpperCase();
      shortLinks.set(code, { osId: id, token: String(token) });
    }
    
    res.json({ code });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
