import { Request, Response } from "express";
import { UsuariosAdminService } from "../../services/admin/usuarios.service.js";
import { updateEmailSchema } from "../../schemas/admin/usuarios.schema.js";
import { EmailDeliveryError } from "../../services/email.service.js";

export const UsuariosAdminController = {
  async listar(req: Request, res: Response) {
    try {
      const oficina_id = req.query.oficina_id ? Number(req.query.oficina_id) : undefined;
      const usuarios = await UsuariosAdminService.listar(oficina_id);
      return res.json(usuarios);
    } catch (err) {
      console.error("Erro ao listar usuários:", err);
      return res.status(500).json({ error: "Erro interno." });
    }
  },

  async updateEmail(req: Request, res: Response) {
    const parsed = updateEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Dados inválidos.", issues: parsed.error.flatten() });
    }

    try {
      const id = Number(req.params.id);
      await UsuariosAdminService.updateEmail(id, parsed.data.email);
      return res.json({ message: "E-mail atualizado com sucesso." });
    } catch (err: any) {
      if (err.message.includes("não encontrado") || err.message.includes("em uso")) {
        return res.status(400).json({ message: err.message });
      }
      console.error("Erro ao atualizar e-mail:", err);
      return res.status(500).json({ error: "Erro interno." });
    }
  },

  async resetSenha(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const resultado = await UsuariosAdminService.resetSenha(id);
      return res.json({ message: `E-mail enviado para ${resultado.email}.` });
    } catch (err: any) {
      if (err instanceof EmailDeliveryError) {
        return res.status(502).json({ message: "Não foi possível enviar o e-mail. Verifique o Resend." });
      }
      if (err.message.includes("não encontrado")) {
        return res.status(404).json({ message: err.message });
      }
      console.error("Erro ao resetar senha:", err);
      return res.status(500).json({ error: "Erro interno." });
    }
  },
};
