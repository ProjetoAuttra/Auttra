import { Request, Response } from "express";
import { RecursosAdicionaisService } from "../services/recursosAdicionais.service.js";
import { mensagemSegura } from "../utils/httpError.js";

function getOfficeId(req: Request) {
  return Number(req.user?.oficinaId ?? req.user?.oficina_id);
}

export const RecursosAdicionaisController = {
  async get(req: Request, res: Response) {
    try {
      return res.json(await RecursosAdicionaisService.get(getOfficeId(req)));
    } catch (error: any) {
      return res.status(400).json({ message: mensagemSegura(error) });
    }
  },

  async update(req: Request, res: Response) {
    try {
      return res.json(await RecursosAdicionaisService.update(getOfficeId(req), req.body));
    } catch (error: any) {
      return res.status(400).json({ message: mensagemSegura(error) });
    }
  },
};
