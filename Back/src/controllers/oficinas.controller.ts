import { Request, Response } from "express";
import { OficinaService } from "../services/oficinas.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { Prisma } from "@prisma/client";

export const OficinaController = {
  async create(req: Request, res: Response) {
    try {
      const oficina = await OficinaService.create(req.body);
      return res.status(201).json(oficina);
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ message: "Ja existe uma oficina com este nome, CNPJ ou e-mail." });
      }
      console.error("Erro ao criar oficina:", err);
      return res.status(400).json({ message: err.message });
    }
  },

  async list(req: Request, res: Response) {
    try {
      const oficinas = await OficinaService.list(getRequiredOfficeId(req));
      return res.status(200).json(oficinas);
    } catch (err: any) {
      console.error("Erro ao listar oficinas:", err);
      return res.status(400).json({ message: err.message });
    }
  },

  async getMyOficina(req: Request, res: Response) {
    try {
      const oficina = await OficinaService.getById(getRequiredOfficeId(req));
      if (!oficina) return res.status(404).json({ message: "Oficina nao encontrada." });
      return res.json(oficina);
    } catch (err: any) {
      console.error("Erro ao buscar oficina:", err);
      return res.status(500).json({ message: err.message });
    }
  },

  async updateMyOficina(req: Request, res: Response) {
    try {
      const oficina = await OficinaService.update(getRequiredOfficeId(req), req.body);
      return res.json(oficina);
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ message: "Ja existe outra oficina com este nome, CNPJ ou e-mail." });
      }
      console.error("Erro ao atualizar oficina:", err);
      return res.status(400).json({ message: err.message });
    }
  },
};
