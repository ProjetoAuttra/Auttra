import { Request, Response } from "express";
import { RecursosSistemaService } from "../services/recursosSistema.service.js";
import { mensagemSegura } from "../utils/httpError.js";

function getOfficeId(req: Request) {
  return Number(req.user?.oficinaId ?? req.user?.oficina_id);
}

export const RecursosSistemaController = {
  async get(req: Request, res: Response) {
    try {
      return res.json(await RecursosSistemaService.get(getOfficeId(req)));
    } catch (error: any) {
      return res.status(400).json({ message: mensagemSegura(error) });
    }
  },

  async update(req: Request, res: Response) {
    try {
      return res.json(await RecursosSistemaService.update(getOfficeId(req), req.body));
    } catch (error: any) {
      return res.status(400).json({ message: mensagemSegura(error) });
    }
  },
};
