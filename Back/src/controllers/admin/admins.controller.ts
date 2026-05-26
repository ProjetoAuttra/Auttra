import { Request, Response } from "express";
import { z } from "zod";
import { AdminsService } from "../../services/admin/admins.service.js";

const criarAdminSchema = z.object({
  nome: z.string().trim().min(2),
  email: z.string().email(),
  senha: z.string().min(12),
});

export const AdminsController = {
  async listar(_req: Request, res: Response) {
    try {
      return res.json(await AdminsService.listar());
    } catch (err) {
      console.error("Erro ao listar admins:", err);
      return res.status(500).json({ error: "Erro interno." });
    }
  },

  async criar(req: Request, res: Response) {
    const parsed = criarAdminSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Dados inválidos.", issues: parsed.error.flatten() });
    try {
      const admin = await AdminsService.criar(parsed.data);
      return res.status(201).json(admin);
    } catch (err: any) {
      return res.status(400).json({ message: err.message ?? "Erro ao criar administrador." });
    }
  },

  async desativar(req: Request, res: Response) {
    try {
      await AdminsService.desativar(Number(req.params.id));
      return res.status(204).send();
    } catch (err: any) {
      if (err.message.includes("não encontrado") || err.message.includes("único")) {
        return res.status(400).json({ message: err.message });
      }
      console.error("Erro ao desativar admin:", err);
      return res.status(500).json({ error: "Erro interno." });
    }
  },

  async reativar(req: Request, res: Response) {
    try {
      await AdminsService.reativar(Number(req.params.id));
      return res.json({ message: "Administrador reativado." });
    } catch (err: any) {
      return res.status(400).json({ message: err.message ?? "Erro ao reativar." });
    }
  },
};
