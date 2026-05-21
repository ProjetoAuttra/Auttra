import { Request, Response } from "express";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { NotificacoesService } from "../services/notificacoes.service.js";

export const NotificacoesController = {
  async list(req: Request, res: Response) {
    try {
      const data = await NotificacoesService.list(getRequiredOfficeId(req), req.user?.permissoes);
      return res.json(data);
    } catch (err: any) {
      console.error("Erro ao listar notificacoes:", err);
      return res.status(500).json({ message: "Erro interno ao listar notificacoes." });
    }
  },

  async getConfig(req: Request, res: Response) {
    try {
      const data = await NotificacoesService.getConfig(getRequiredOfficeId(req));
      return res.json(data);
    } catch (err: any) {
      console.error("Erro ao buscar configuracoes de notificacoes:", err);
      return res.status(500).json({ message: "Erro interno ao buscar configuracoes de notificacoes." });
    }
  },

  async updateConfig(req: Request, res: Response) {
    try {
      const data = await NotificacoesService.updateConfig(getRequiredOfficeId(req), req.body);
      return res.json(data);
    } catch (err: any) {
      console.error("Erro ao salvar configuracoes de notificacoes:", err);
      return res.status(400).json({ message: err.message ?? "Nao foi possivel salvar as configuracoes." });
    }
  },
};
