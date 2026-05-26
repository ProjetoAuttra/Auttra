import { Request, Response } from "express";
import { OficinasAdminService } from "../../services/admin/oficinas.service.js";
import { criarOficinaSchema, updateOficinaSchema } from "../../schemas/admin/oficinas.schema.js";

export const OficinasAdminController = {
  async listar(req: Request, res: Response) {
    try {
      const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : undefined;
      const oficinas = await OficinasAdminService.listar(q);
      return res.json(oficinas);
    } catch (err) {
      console.error("Erro ao listar oficinas:", err);
      return res.status(500).json({ error: "Erro interno." });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const oficina = await OficinasAdminService.getById(id);
      return res.json(oficina);
    } catch (err: any) {
      if (err.message === "Oficina não encontrada.") return res.status(404).json({ message: err.message });
      console.error("Erro ao buscar oficina:", err);
      return res.status(500).json({ error: "Erro interno." });
    }
  },

  async criar(req: Request, res: Response) {
    const parsed = criarOficinaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Dados inválidos.", issues: parsed.error.flatten() });
    }

    try {
      const resultado = await OficinasAdminService.criarOficinaCompleta(parsed.data);
      return res.status(201).json({
        oficina: { id: resultado.oficina.id, nome: resultado.oficina.nome },
        usuario: { id: resultado.usuario.id, email: resultado.usuario.email },
      });
    } catch (err: any) {
      console.error("Erro ao criar oficina:", err);
      return res.status(400).json({ message: err.message ?? "Erro ao criar oficina." });
    }
  },

  async update(req: Request, res: Response) {
    const parsed = updateOficinaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Dados inválidos.", issues: parsed.error.flatten() });
    }

    try {
      const id = Number(req.params.id);
      const oficina = await OficinasAdminService.update(id, parsed.data);
      return res.json(oficina);
    } catch (err: any) {
      if (err.message === "Oficina não encontrada.") return res.status(404).json({ message: err.message });
      console.error("Erro ao atualizar oficina:", err);
      return res.status(500).json({ error: "Erro interno." });
    }
  },

  async softDelete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await OficinasAdminService.softDelete(id);
      return res.status(204).send();
    } catch (err: any) {
      if (err.message === "Oficina não encontrada.") return res.status(404).json({ message: err.message });
      console.error("Erro ao desativar oficina:", err);
      return res.status(500).json({ error: "Erro interno." });
    }
  },

  async reativar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await OficinasAdminService.reativar(id);
      return res.json({ message: "Oficina reativada com sucesso." });
    } catch (err: any) {
      if (err.message.includes("não encontrada") || err.message.includes("já está ativa")) {
        return res.status(400).json({ message: err.message });
      }
      console.error("Erro ao reativar oficina:", err);
      return res.status(500).json({ error: "Erro interno." });
    }
  },
};
