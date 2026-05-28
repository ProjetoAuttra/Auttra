import { Request, Response } from "express";
import { WhatsAppService } from "../services/whatsapp.service.js";

export const WhatsAppController = {
  async send(req: Request, res: Response) {
    try {
      const { phone, message } = req.body;
      if (!phone || !message) {
        return res.status(400).json({ message: "Telefone e mensagem são obrigatórios." });
      }

      const oficinaId = Number(req.user?.oficinaId ?? req.user?.oficina_id);
      if (!oficinaId) {
        return res.status(403).json({ message: "Oficina não identificada no token." });
      }

      const result = await WhatsAppService.send({ phone, message, oficinaId });
      return res.json({ success: true, data: result });
    } catch (err: any) {
      console.error("Erro no WhatsAppController.send:", err);
      const status = err.status || 500;
      return res.status(status).json({
        message: err.message ?? "Erro interno ao enviar mensagem pelo WhatsApp.",
        error: err.response ?? null,
      });
    }
  },

  async getConnectStatus(req: Request, res: Response) {
    try {
      const oficinaId = Number(req.user?.oficinaId ?? req.user?.oficina_id);
      if (!oficinaId) {
        return res.status(403).json({ message: "Oficina não identificada no token." });
      }

      const result = await WhatsAppService.getConnectStatus(oficinaId);
      return res.json(result);
    } catch (err: any) {
      console.error("Erro no WhatsAppController.getConnectStatus:", err);
      const status = err.status || 500;
      return res.status(status).json({
        message: err.message ?? "Erro ao obter status de conexão com o WhatsApp.",
      });
    }
  }
};

