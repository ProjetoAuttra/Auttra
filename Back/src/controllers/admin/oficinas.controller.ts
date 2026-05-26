import { Request, Response } from "express";
import { OficinasAdminService } from "../../services/admin/oficinas.service.js";
import { AdminAuditService } from "../../services/admin/audit.service.js";
import { criarOficinaSchema, updateOficinaSchema } from "../../schemas/admin/oficinas.schema.js";

function queryNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const OficinasAdminController = {
  async listar(req: Request, res: Response) {
    try {
      const oficinas = await OficinasAdminService.listar({
        q: typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : undefined,
        status: typeof req.query.status === "string" ? req.query.status as any : undefined,
        cidade: typeof req.query.cidade === "string" && req.query.cidade.trim() ? req.query.cidade.trim() : undefined,
        gestor: typeof req.query.gestor === "string" && req.query.gestor.trim() ? req.query.gestor.trim() : undefined,
        page: queryNumber(req.query.page),
        pageSize: queryNumber(req.query.pageSize),
        sortBy: typeof req.query.sortBy === "string" ? req.query.sortBy as any : undefined,
        sortDir: req.query.sortDir === "asc" ? "asc" : "desc",
      });
      return res.json(oficinas);
    } catch (err) {
      console.error("Erro ao listar oficinas:", err);
      return res.status(500).json({ message: "Erro interno." });
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
      return res.status(500).json({ message: "Erro interno." });
    }
  },

  async historico(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const take = Math.min(Number(req.query.take) || 50, 100);
      return res.json(await AdminAuditService.listarPorOficina(id, take));
    } catch (err) {
      console.error("Erro ao buscar histórico da oficina:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },

  async criar(req: Request, res: Response) {
    const parsed = criarOficinaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Dados inválidos.", issues: parsed.error.flatten() });
    }

    try {
      const resultado = await OficinasAdminService.criarOficinaCompleta(parsed.data);
      await AdminAuditService.log({
        req,
        oficinaId: resultado.oficina.id,
        action: "oficina.create",
        entityType: "oficina",
        entityId: resultado.oficina.id,
        message: `Oficina ${resultado.oficina.nome} criada.`,
        metadata: { gestor_usuario_id: resultado.usuario.id },
      });
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
      await AdminAuditService.log({
        req,
        oficinaId: id,
        action: "oficina.update",
        entityType: "oficina",
        entityId: id,
        message: `Oficina ${oficina.nome} atualizada.`,
        metadata: { campos: Object.keys(parsed.data) },
      });
      return res.json(oficina);
    } catch (err: any) {
      if (err.message?.includes("Oficina não encontrada")) return res.status(404).json({ message: err.message });
      if (err.message?.includes("Gestor inválido") || err.message?.includes("Cidade e UF")) return res.status(400).json({ message: err.message });
      console.error("Erro ao atualizar oficina:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },

  async softDelete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await OficinasAdminService.softDelete(id);
      await AdminAuditService.log({
        req,
        oficinaId: id,
        action: "oficina.deactivate",
        entityType: "oficina",
        entityId: id,
        message: "Oficina desativada.",
      });
      return res.status(204).send();
    } catch (err: any) {
      if (err.message === "Oficina não encontrada.") return res.status(404).json({ message: err.message });
      console.error("Erro ao desativar oficina:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },

  async reativar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await OficinasAdminService.reativar(id);
      await AdminAuditService.log({
        req,
        oficinaId: id,
        action: "oficina.reactivate",
        entityType: "oficina",
        entityId: id,
        message: "Oficina reativada.",
      });
      return res.json({ message: "Oficina reativada com sucesso." });
    } catch (err: any) {
      if (err.message.includes("não encontrada") || err.message.includes("já está ativa")) {
        return res.status(400).json({ message: err.message });
      }
      console.error("Erro ao reativar oficina:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },
};
