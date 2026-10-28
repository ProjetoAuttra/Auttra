import { Request, Response } from "express";
import { z } from "zod";
import { AdminsService } from "../../services/admin/admins.service.js";
import { AdminAuditService } from "../../services/admin/audit.service.js";

const criarAdminSchema = z.object({
  nome: z.string().trim().min(2),
  email: z.string().email(),
});

const atualizarAdminSchema = criarAdminSchema;

function linkPublico(link: { email: string; reset_url: string; email_sent: boolean; expires_at: Date }) {
  return { email: link.email, reset_url: link.reset_url, email_sent: link.email_sent, expires_at: link.expires_at };
}

export const AdminsController = {
  async listar(_req: Request, res: Response) {
    try {
      return res.json(await AdminsService.listar());
    } catch (err) {
      console.error("Erro ao listar admins:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },

  async criar(req: Request, res: Response) {
    const parsed = criarAdminSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Dados inválidos.", issues: parsed.error.flatten() });
    try {
      const { usuario, convite } = await AdminsService.criar(parsed.data);
      await AdminAuditService.log({
        req,
        action: "admin.create",
        entityType: "usuario",
        entityId: usuario.id,
        message: `Usuário do painel ${usuario.email} criado.`,
        metadata: { convite_email_sent: convite.email_sent },
      });
      return res.status(201).json({ usuario, convite: linkPublico(convite) });
    } catch (err: any) {
      return res.status(400).json({ message: err.message ?? "Erro ao criar administrador." });
    }
  },

  async atualizar(req: Request, res: Response) {
    const parsed = atualizarAdminSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Dados inválidos.", issues: parsed.error.flatten() });
    try {
      const id = Number(req.params.id);
      const usuario = await AdminsService.atualizar(id, parsed.data);
      await AdminAuditService.log({
        req,
        action: "admin.update",
        entityType: "usuario",
        entityId: id,
        message: `Usuário do painel ${usuario.email} atualizado.`,
      });
      return res.json(usuario);
    } catch (err: any) {
      return res.status(400).json({ message: err.message ?? "Erro ao atualizar usuário." });
    }
  },

  async linkSenha(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const link = await AdminsService.linkSenha(id);
      await AdminAuditService.log({
        req,
        action: "admin.password_link",
        entityType: "usuario",
        entityId: id,
        message: "Link de redefinição de senha gerado para usuário do painel.",
        metadata: { email_sent: link.email_sent },
      });
      return res.json(linkPublico(link));
    } catch (err: any) {
      return res.status(400).json({ message: err.message ?? "Erro ao gerar link." });
    }
  },

  async desativar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await AdminsService.desativar(id, req.user?.id);
      await AdminAuditService.log({
        req,
        action: "admin.deactivate",
        entityType: "usuario",
        entityId: id,
        message: "Administrador desativado.",
      });
      return res.status(204).send();
    } catch (err: any) {
      if (err.message.includes("não encontrado") || err.message.includes("único") || err.message.includes("própria")) {
        return res.status(400).json({ message: err.message });
      }
      console.error("Erro ao desativar admin:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },

  async reativar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await AdminsService.reativar(id);
      await AdminAuditService.log({
        req,
        action: "admin.reactivate",
        entityType: "usuario",
        entityId: id,
        message: "Administrador reativado.",
      });
      return res.json({ message: "Administrador reativado." });
    } catch (err: any) {
      return res.status(400).json({ message: err.message ?? "Erro ao reativar." });
    }
  },
};
