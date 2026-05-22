import { Request, Response } from "express";
import { FuncionariosService } from "../services/funcionarios.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";

function isNotFound(err: any): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  return msg.includes("nao encontrado") || msg.includes("não encontrado");
}

export const FuncionariosController = {
  async list(req: Request, res: Response) {
    try {
      const search = req.query.search ? String(req.query.search) : "";
      const funcionarios = await FuncionariosService.list(getRequiredOfficeId(req), search);
      res.json(funcionarios);
    } catch (error: any) {
      console.error("Erro ao listar funcionários:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const funcionario = await FuncionariosService.getById(Number(id), getRequiredOfficeId(req));

      if (!funcionario) {
        return res.status(404).json({ error: "Funcionário não encontrado." });
      }

      res.json(funcionario);
    } catch (error: any) {
      console.error("Erro ao buscar funcionário:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async create(req: Request, res: Response) {
    try {

      const {
        nome,
        email,
        telefone,
        cargo,
        senha,
        data_contratacao,
        perfil_acesso_id,
      } = req.body;

      if (!nome || !email || !telefone || !cargo || !senha) {
        return res
          .status(400)
          .json({ error: "Preencha todos os campos obrigatórios." });
      }

      const funcionario = await FuncionariosService.create({
        nome,
        email,
        telefone,
        cargo,
        senha,
        data_contratacao,
        oficina_id: getRequiredOfficeId(req),
        perfil_acesso_id,
      });

      res.status(201).json(funcionario);
    } catch (error: any) {
      console.error("Erro ao criar funcionário:", error);
      res.status(400).json({ error: error.message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const funcionario = await FuncionariosService.update(Number(id), data, getRequiredOfficeId(req));
      res.json(funcionario);
    } catch (error: any) {
      if (isNotFound(error)) return res.status(404).json({ message: error.message });
      console.error("Erro ao atualizar funcionário:", error);
      res.status(400).json({ message: error.message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await FuncionariosService.delete(Number(id), getRequiredOfficeId(req));
      res.status(204).send();
    } catch (error: any) {
      if (isNotFound(error)) return res.status(404).json({ message: error.message });
      console.error("Erro ao excluir funcionário:", error);
      res.status(400).json({ message: error.message });
    }
  },
};
