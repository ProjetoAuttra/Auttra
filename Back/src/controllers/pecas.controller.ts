import { Request, Response } from "express";
import { PecasService } from "../services/pecas.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";

export const PecasController = {
  async list(req: Request, res: Response) {
    try {
      const pecas = await PecasService.list(getRequiredOfficeId(req));
      return res.json(pecas);
    } catch (error) {
      console.error("Erro ao listar peças:", error);
      res.status(500).json({ error: "Erro interno ao listar peças" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const novaPeca = await PecasService.create({ ...req.body, oficina_id: getRequiredOfficeId(req) });
      return res.status(201).json(novaPeca);
    } catch (error) {
      console.error("Erro ao criar peça:", error);
      res.status(500).json({ error: "Erro interno ao criar peça" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const pecaAtualizada = await PecasService.update(id, req.body, getRequiredOfficeId(req));
      return res.json(pecaAtualizada);
    } catch (error) {
      console.error("Erro ao atualizar peça:", error);
      res.status(500).json({ error: "Erro interno ao atualizar peça" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await PecasService.delete(id, getRequiredOfficeId(req));
      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir peça:", error);
      res.status(500).json({ error: "Erro interno ao excluir peça" });
    }
  },

  async ajuste(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { tipo, quantidade } = req.body;
      const peca = await PecasService.ajuste(id, tipo, Number(quantidade), getRequiredOfficeId(req));
      return res.json(peca);
    } catch (error) {
      console.error("Erro ao ajustar estoque:", error);
      const msg = error instanceof Error ? error.message : "Erro ao ajustar estoque.";
      res.status(400).json({ error: msg });
    }
  },
};
