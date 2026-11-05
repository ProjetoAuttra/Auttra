import { Request, Response } from "express";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { sendServiceError } from "../utils/httpError.js";
import { AgendaConfigService, DocumentosConfigService, FinanceiroConfigService } from "../services/configuracoesOperacionais.service.js";

export const ConfiguracoesOperacionaisController = {
  async getAgenda(req: Request, res: Response) {
    try {
      const data = await AgendaConfigService.get(getRequiredOfficeId(req));
      return res.json(data);
    } catch (err: any) {
      console.error("Erro ao buscar configuracoes de agenda:", err);
      return res.status(500).json({ message: "Erro interno ao buscar configuracoes de agenda." });
    }
  },

  async updateAgenda(req: Request, res: Response) {
    try {
      const data = await AgendaConfigService.update(getRequiredOfficeId(req), req.body);
      return res.json(data);
    } catch (err: any) {
      console.error("Erro ao salvar configuracoes de agenda:", err);
      return res.status(400).json({ message: err.message ?? "Nao foi possivel salvar as configuracoes de agenda." });
    }
  },

  async getFinanceiro(req: Request, res: Response) {
    try {
      const data = await FinanceiroConfigService.get(getRequiredOfficeId(req));
      return res.json(data);
    } catch (err: any) {
      console.error("Erro ao buscar configuracoes financeiras:", err);
      return res.status(500).json({ message: "Erro interno ao buscar configuracoes financeiras." });
    }
  },

  async updateFinanceiro(req: Request, res: Response) {
    try {
      const data = await FinanceiroConfigService.update(getRequiredOfficeId(req), req.body);
      return res.json(data);
    } catch (err: any) {
      console.error("Erro ao salvar configuracoes financeiras:", err);
      return res.status(400).json({ message: err.message ?? "Nao foi possivel salvar as configuracoes financeiras." });
    }
  },

  async getDocumentos(req: Request, res: Response) {
    try {
      const data = await DocumentosConfigService.get(getRequiredOfficeId(req));
      return res.json(data);
    } catch (err: any) {
      console.error("Erro ao buscar configuracoes de documentos:", err);
      return res.status(500).json({ message: "Erro interno ao buscar as configurações de orçamentos e OS." });
    }
  },

  async updateDocumentos(req: Request, res: Response) {
    try {
      const data = await DocumentosConfigService.update(getRequiredOfficeId(req), req.body);
      return res.json(data);
    } catch (err) {
      return sendServiceError(res, err, "salvar configuracoes de documentos");
    }
  },
};
