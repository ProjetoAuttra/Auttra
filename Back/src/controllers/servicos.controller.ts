import { Request, Response } from "express";
import { ServicosService } from "../services/servicos.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { Prisma } from "@prisma/client";

function isNotFound(err: any): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  return msg.includes("nao encontrado") || msg.includes("não encontrado");
}

export const ServicosController = {
  async list(req: Request, res: Response) {
    try {
      const search = req.query.search ? String(req.query.search) : "";
      return res.json(await ServicosService.list(getRequiredOfficeId(req), search));
    } catch (err: any) {
      console.error("Erro ao listar servicos:", err);
      return res.status(500).json({ error: err.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      return res.json(await ServicosService.getById(Number(req.params.id), getRequiredOfficeId(req)));
    } catch (err: any) {
      if (isNotFound(err)) return res.status(404).json({ message: err.message });
      console.error("Erro ao buscar servico:", err);
      return res.status(500).json({ error: "Erro interno" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const servico = await ServicosService.create({ ...req.body, oficina_id: getRequiredOfficeId(req) });
      const { _reativado, ...body } = servico as any;
      return res.status(_reativado ? 200 : 201).json(body);
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ message: "Ja existe um servico com este nome nesta oficina." });
      }
      console.error("Erro ao criar servico:", err);
      return res.status(400).json({ message: err.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const atualizado = await ServicosService.update(Number(req.params.id), req.body, getRequiredOfficeId(req));
      return res.json(atualizado);
    } catch (err: any) {
      if (isNotFound(err)) return res.status(404).json({ message: err.message });
      console.error("Erro ao atualizar servico:", err);
      return res.status(400).json({ message: err.message });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      await ServicosService.remove(Number(req.params.id), getRequiredOfficeId(req));
      return res.status(204).send();
    } catch (err: any) {
      if (isNotFound(err)) return res.status(404).json({ message: err.message });
      console.error("Erro ao remover servico:", err);
      return res.status(500).json({ error: "Erro interno" });
    }
  },
};
