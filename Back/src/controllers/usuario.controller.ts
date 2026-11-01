import { Request, Response } from "express";
import { UsuarioService } from "../services/usuario.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { sendServiceError } from "../utils/httpError.js";

export const UsuarioController = {
  async create(req: Request, res: Response) {
    try {
      const usuario = await UsuarioService.create({ ...req.body, oficina_id: getRequiredOfficeId(req) });
      return res.status(201).json(usuario);
    } catch (error: any) {
      return sendServiceError(res, error, "criar usuario");
    }
  },

  async list(req: Request, res: Response) {
    try {
      const usuarios = await UsuarioService.list(getRequiredOfficeId(req));
      return res.status(200).json(usuarios);
    } catch (error: any) {
      console.error("Erro ao listar usuários:", error);
      return res.status(400).json({ message: error.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const usuario = await UsuarioService.getById(id, getRequiredOfficeId(req));
      return res.status(200).json(usuario);
    } catch (error: any) {
      console.error("Erro ao buscar usuário por ID:", error);
      return res.status(400).json({ message: error.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const usuario = await UsuarioService.update(id, req.body, getRequiredOfficeId(req));
      return res.status(200).json(usuario);
    } catch (error: any) {
      console.error("Erro ao atualizar usuário:", error);
      return res.status(400).json({ message: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const usuario = await UsuarioService.delete(id, getRequiredOfficeId(req));
      return res.status(200).json(usuario);
    } catch (error: any) {
      console.error("Erro ao deletar usuário:", error);
      return res.status(400).json({ message: error.message });
    }
  },
};
