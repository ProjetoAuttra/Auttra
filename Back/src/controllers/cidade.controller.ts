import { Request, Response } from "express";
import { CidadeService } from "../services/cidade.service.js";
import { mensagemSegura } from "../utils/httpError.js";

export const CidadeController = {
  async create(req: Request, res: Response) {
    try {
      const cidade = await CidadeService.create(req.body);
      res.json(cidade);
    } catch (error: any) {
      res.status(400).json({ message: mensagemSegura(error) });
    }
  },

  async list(req: Request, res: Response) {
    try {
      const cidades = await CidadeService.list();
      res.json(cidades);
    } catch (error: any) {
      res.status(500).json({ message: mensagemSegura(error) });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const cidade = await CidadeService.getById(id);
      res.json(cidade);
    } catch (error: any) {
      res.status(404).json({ message: mensagemSegura(error) });
    }
  },
};
