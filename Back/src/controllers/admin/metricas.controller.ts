import { Request, Response } from "express";
import { MetricasAdminService } from "../../services/admin/metricas.service.js";

export const MetricasAdminController = {
  async get(_req: Request, res: Response) {
    try {
      const metricas = await MetricasAdminService.get();
      return res.json(metricas);
    } catch (err) {
      console.error("Erro ao buscar métricas:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },
};
