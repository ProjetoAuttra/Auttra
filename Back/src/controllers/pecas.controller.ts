import { Request, Response } from "express";
import { PecasService } from "../services/pecas.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { Prisma } from "@prisma/client";

export const PecasController = {
  async list(req: Request, res: Response) {
    try {
      const pecas = await PecasService.list(getRequiredOfficeId(req));
      return res.json(pecas);
    } catch (err: any) {
      console.error("Erro ao listar pecas:", err);
      return res.status(500).json({ error: "Erro interno ao listar pecas" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const novaPeca = await PecasService.create({ ...req.body, oficina_id: getRequiredOfficeId(req) });
      return res.status(201).json(novaPeca);
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ message: "Ja existe uma peca com este nome nesta oficina." });
      }
      console.error("Erro ao criar peca:", err);
      return res.status(500).json({ error: "Erro interno ao criar peca" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const pecaAtualizada = await PecasService.update(id, req.body, getRequiredOfficeId(req));
      return res.json(pecaAtualizada);
    } catch (err: any) {
      console.error("Erro ao atualizar peca:", err);
      return res.status(500).json({ error: "Erro interno ao atualizar peca" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await PecasService.delete(id, getRequiredOfficeId(req));
      return res.status(204).send();
    } catch (err: any) {
      console.error("Erro ao excluir peca:", err);
      return res.status(500).json({ error: "Erro interno ao excluir peca" });
    }
  },

  async ajuste(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { tipo, quantidade } = req.body;
      const peca = await PecasService.ajuste(id, tipo, Number(quantidade), getRequiredOfficeId(req));
      return res.json(peca);
    } catch (err: any) {
      console.error("Erro ao ajustar estoque:", err);
      const msg = err instanceof Error ? err.message : "Erro ao ajustar estoque.";
      return res.status(400).json({ error: msg });
    }
  },
};
