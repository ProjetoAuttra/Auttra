import { Request, Response } from "express";
import { WhatsAppDeliveryError, WhatsAppService } from "../services/whatsapp.service.js";
import { isErroDeNegocio, mensagemSegura } from "../utils/httpError.js";

/**
 * Erro do envio pelo WhatsApp. A mensagem do WhatsAppDeliveryError é nossa e pode ir para o usuário;
 * a resposta da API externa e o status dela ficam só no log (falha lá fora vira 502 aqui).
 */
function responderErroWhatsApp(res: Response, err: unknown, fallback: string) {
  if (err instanceof WhatsAppDeliveryError) {
    return res.status(err.status ? 502 : 503).json({ message: err.message });
  }
  return res.status(isErroDeNegocio(err) ? 400 : 500).json({ message: mensagemSegura(err, fallback) });
}

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
    } catch (err) {
      console.error("Erro no WhatsAppController.send:", err);
      return responderErroWhatsApp(res, err, "Erro interno ao enviar mensagem pelo WhatsApp.");
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
    } catch (err) {
      console.error("Erro no WhatsAppController.getConnectStatus:", err);
      return responderErroWhatsApp(res, err, "Erro ao obter status de conexão com o WhatsApp.");
    }
  }
};

