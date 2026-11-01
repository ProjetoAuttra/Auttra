import { Request, Response } from "express";
import { AgendamentoService } from "../services/agendamento.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { parsePaginacao, responderLista } from "../utils/paginacao.js";

export const AgendamentoController = {
  async list(req: Request, res: Response) {
    responderLista(res, await AgendamentoService.list(getRequiredOfficeId(req), parsePaginacao(req.query)));
  },

  async getById(req: Request, res: Response) {
    const id = Number(req.params.id);
    res.json(await AgendamentoService.getById(id, getRequiredOfficeId(req)));
  },

  async listByOficina(req: Request, res: Response) {
    const oficina_id = getRequiredOfficeId(req);
    res.json(await AgendamentoService.listByOficina(oficina_id));
  },

  async create(req: Request, res: Response) {
    res.status(201).json(await AgendamentoService.create({ ...req.body, oficina_id: getRequiredOfficeId(req) }));
  },

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    res.json(await AgendamentoService.update(id, req.body, getRequiredOfficeId(req)));
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    await AgendamentoService.remove(id, getRequiredOfficeId(req));
    res.status(204).send();
  },
};
