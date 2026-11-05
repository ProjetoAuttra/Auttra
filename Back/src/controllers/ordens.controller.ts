import { Request, Response } from "express";
import { OrdensService } from "../services/ordens.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { parsePaginacao, responderLista, textoQuery } from "../utils/paginacao.js";

export const OrdensController = {
  async list(req: Request, res: Response) {
    const funcionarioId = Number(req.query.funcionario_id);
    responderLista(
      res,
      await OrdensService.list(
        getRequiredOfficeId(req),
        {
          status: textoQuery(req.query.status) || undefined,
          funcionarioId: funcionarioId > 0 ? funcionarioId : undefined,
          data: textoQuery(req.query.data) || undefined,
        },
        parsePaginacao(req.query)
      )
    );
  },

  async getById(req: Request, res: Response) {
    res.json(await OrdensService.getById(Number(req.params.id), getRequiredOfficeId(req)));
  },

  async create(req: Request, res: Response) {
    const nova = await OrdensService.create({ ...req.body, oficina_id: getRequiredOfficeId(req) });
    res.status(201).json(nova);
  },

  async update(req: Request, res: Response) {
    res.json(await OrdensService.update(Number(req.params.id), req.body, getRequiredOfficeId(req)));
  },

  async remove(req: Request, res: Response) {
    await OrdensService.delete(Number(req.params.id), getRequiredOfficeId(req));
    res.status(204).send();
  },
};
