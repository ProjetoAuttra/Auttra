import { Request, Response } from "express";
import { UsuariosAdminService } from "../../services/admin/usuarios.service.js";
import { AdminAuditService } from "../../services/admin/audit.service.js";
import { updateEmailSchema } from "../../schemas/admin/usuarios.schema.js";

export const UsuariosAdminController = {
  async listar(req: Request, res: Response) {
    try {
      const oficina_id = req.query.oficina_id ? Number(req.query.oficina_id) : undefined;
      const usuarios = await UsuariosAdminService.listar(oficina_id);
      return res.json(usuarios);
    } catch (err) {
      console.error("Erro ao listar usuários:", err);
      return res.status(500).json({ message: "Erro interno." });
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
      await AdminAuditService.log({
        req,
        action: "usuario.email_update",
        entityType: "usuario",
        entityId: id,
        message: "E-mail de usuário alterado pelo admin.",
        metadata: { email: parsed.data.email },
      });
      return res.json({ message: "E-mail atualizado com sucesso." });
    } catch (err: any) {
      if (err.message.includes("não encontrado") || err.message.includes("em uso")) {
        return res.status(400).json({ message: err.message });
      }
      console.error("Erro ao atualizar e-mail:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },

  async resetSenha(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const resultado = await UsuariosAdminService.resetSenha(id);
      await AdminAuditService.log({
        req,
        action: "usuario.password_reset_link",
        entityType: "usuario",
        entityId: id,
        message: "Link de redefinição de senha gerado pelo admin.",
        metadata: { email_sent: resultado.email_sent, expires_at: resultado.expires_at },
      });
      return res.json({
        message: resultado.email_sent ? "Link de redefinição enviado por e-mail." : "Link de redefinição gerado. O e-mail não pôde ser enviado.",
        email: resultado.email,
        reset_url: resultado.reset_url,
        expires_at: resultado.expires_at,
        email_sent: resultado.email_sent,
      });
    } catch (err: any) {
      if (err.message.includes("não encontrado")) {
        return res.status(404).json({ message: err.message });
      }
      console.error("Erro ao gerar link de redefinição:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },
};
