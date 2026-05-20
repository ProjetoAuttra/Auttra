import { Request, Response } from "express";
import { VeiculosService } from "../services/veiculos.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { Prisma } from "@prisma/client";

export const VeiculosController = {
  async list(req: Request, res: Response) {
    try {
      return res.json(await VeiculosService.list({
        oficina_id: getRequiredOfficeId(req),
        cliente_id: req.query.cliente_id ? Number(req.query.cliente_id) : undefined,
      }));
    } catch (err: any) {
      console.error("Erro ao listar veiculos:", err);
      return res.status(500).json({ error: err.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      return res.json(await VeiculosService.getById(Number(req.params.id), getRequiredOfficeId(req)));
    } catch (err: any) {
      console.error("Erro ao buscar veiculo:", err);
      return res.status(500).json({ error: err.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const novo = await VeiculosService.create({ ...req.body, oficina_id: getRequiredOfficeId(req) });
      return res.status(201).json(novo);
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ message: "Ja existe um veiculo com esta placa nesta oficina." });
      }
      console.error("Erro ao criar veiculo:", err);
      return res.status(400).json({ message: err.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      return res.json(await VeiculosService.update(Number(req.params.id), req.body, getRequiredOfficeId(req)));
    } catch (err: any) {
      console.error("Erro ao atualizar veiculo:", err);
      return res.status(400).json({ message: err.message });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      await VeiculosService.remove(Number(req.params.id), getRequiredOfficeId(req));
      return res.status(204).send();
    } catch (err: any) {
      console.error("Erro ao remover veiculo:", err);
      return res.status(400).json({ message: err.message });
    }
  },
};
