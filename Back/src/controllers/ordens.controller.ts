import { Request, Response } from "express";
import { OrdensService } from "../services/ordens.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { sendServiceError } from "../utils/httpError.js";

export const OrdensController = {
  async list(req: Request, res: Response) {
    try {
      res.json(await OrdensService.list(getRequiredOfficeId(req)));
    } catch (err) {
      sendServiceError(res, err, "ordens/list");
    }
  },

  async getById(req: Request, res: Response) {
    try {
      res.json(await OrdensService.getById(Number(req.params.id), getRequiredOfficeId(req)));
    } catch (err) {
      sendServiceError(res, err, "ordens/getById");
    }
  },

  async create(req: Request, res: Response) {
    try {
      const nova = await OrdensService.create({ ...req.body, oficina_id: getRequiredOfficeId(req) });
      res.status(201).json(nova);
    } catch (err) {
      sendServiceError(res, err, "ordens/create");
    }
  },

  async update(req: Request, res: Response) {
    try {
      res.json(await OrdensService.update(Number(req.params.id), req.body, getRequiredOfficeId(req)));
    } catch (err) {
      sendServiceError(res, err, "ordens/update");
    }
  },

  async remove(req: Request, res: Response) {
    try {
      await OrdensService.delete(Number(req.params.id), getRequiredOfficeId(req));
      res.status(204).send();
    } catch (err) {
      sendServiceError(res, err, "ordens/remove");
    }
  },
};
