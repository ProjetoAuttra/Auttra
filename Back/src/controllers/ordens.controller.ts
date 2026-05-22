import { Request, Response } from "express";
import { OrdensService } from "../services/ordens.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";

function isNotFound(err: any): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  return msg.includes("nao encontrado") || msg.includes("não encontrado");
}

export const OrdensController = {
  async list(req: Request, res: Response) {
    try {
      res.json(await OrdensService.list(getRequiredOfficeId(req)));
    } catch (err: any) {
      console.error("Erro ao listar OS:", err);
      res.status(500).json({ error: "Erro interno" });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      res.json(await OrdensService.getById(Number(req.params.id), getRequiredOfficeId(req)));
    } catch (err: any) {
      if (isNotFound(err)) return res.status(404).json({ message: err.message });
      console.error("Erro ao buscar OS:", err);
      res.status(500).json({ error: "Erro interno" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const nova = await OrdensService.create({ ...req.body, oficina_id: getRequiredOfficeId(req) });
      res.status(201).json(nova);
    } catch (err: any) {
      console.error("Erro ao criar OS:", err);
      res.status(400).json({ message: err.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const atualizada = await OrdensService.update(Number(req.params.id), req.body, getRequiredOfficeId(req));
      res.json(atualizada);
    } catch (err: any) {
      if (isNotFound(err)) return res.status(404).json({ message: err.message });
      console.error("Erro ao atualizar OS:", err);
      res.status(400).json({ message: err.message });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      await OrdensService.delete(Number(req.params.id), getRequiredOfficeId(req));
      res.status(204).send();
    } catch (err: any) {
      if (isNotFound(err)) return res.status(404).json({ message: err.message });
      console.error("Erro ao excluir OS:", err);
      res.status(500).json({ error: "Erro interno" });
    }
  },
};
