import { Request, Response } from "express";
import { FornecedoresService } from "../services/fornecedores.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { Prisma } from "@prisma/client";

export const FornecedoresController = {
  async list(req: Request, res: Response) {
    try {
      return res.json(await FornecedoresService.list(getRequiredOfficeId(req)));
    } catch (err: any) {
      console.error("Erro ao listar fornecedores:", err);
      return res.status(500).json({ error: err.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      return res.json(await FornecedoresService.getById(Number(req.params.id), getRequiredOfficeId(req)));
    } catch (err: any) {
      console.error("Erro ao buscar fornecedor:", err);
      return res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const novo = await FornecedoresService.create({ ...req.body, oficina_id: getRequiredOfficeId(req) });
      return res.status(201).json(novo);
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ message: "Ja existe um fornecedor com este nome ou e-mail nesta oficina." });
      }
      console.error("Erro ao criar fornecedor:", err);
      return res.status(400).json({ message: err.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      return res.json(await FornecedoresService.update(Number(req.params.id), req.body, getRequiredOfficeId(req)));
    } catch (err: any) {
      console.error("Erro ao atualizar fornecedor:", err);
      return res.status(400).json({ message: err.message });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      await FornecedoresService.remove(Number(req.params.id), getRequiredOfficeId(req));
      return res.status(204).send();
    } catch (err: any) {
      console.error("Erro ao remover fornecedor:", err);
      return res.status(400).json({ message: err.message });
    }
  },
};
