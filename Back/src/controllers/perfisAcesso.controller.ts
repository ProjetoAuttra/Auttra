import { Request, Response } from "express";
import { PerfisAcessoService } from "../services/perfisAcesso.service.js";
import { Prisma } from "@prisma/client";

function getOfficeId(req: Request) {
  return Number(req.user?.oficinaId ?? req.user?.oficina_id);
}

export const PerfisAcessoController = {
  metadata(_req: Request, res: Response) {
    return res.json(PerfisAcessoService.metadata());
  },

  async list(req: Request, res: Response) {
    try {
      return res.json(await PerfisAcessoService.list(getOfficeId(req)));
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const perfil = await PerfisAcessoService.create(getOfficeId(req), req.body);
      return res.status(201).json(perfil);
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return res.status(409).json({ message: "Ja existe um perfil com este nome nesta oficina." });
      }
      return res.status(400).json({ message: error.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const perfil = await PerfisAcessoService.update(Number(req.params.id), getOfficeId(req), req.body);
      return res.json(perfil);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await PerfisAcessoService.delete(Number(req.params.id), getOfficeId(req));
      return res.status(204).send();
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  },
};
