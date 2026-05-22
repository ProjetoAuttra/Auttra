import { Request, Response } from "express";
import { PagamentosService } from "../services/pagamentos.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";

function isNotFound(err: any): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  return msg.includes("nao encontrado") || msg.includes("não encontrado");
}

export const pagamentosController = {
  async listar(req: Request, res: Response) {
    try {
      const oficina_id = getRequiredOfficeId(req);

      const pagamentos = await PagamentosService.list(oficina_id);
      res.json(pagamentos);
    } catch (err: any) {
      console.error("Erro ao listar pagamentos:", err);
      res.status(500).json({ error: err.message });
    }
  },

  async listarPorCliente(req: Request, res: Response) {
    try {
      const cliente_id = Number(req.params.id);
      if (!cliente_id)
        return res.status(400).json({ error: "cliente_id é obrigatório." });

      const pagamentos = await PagamentosService.listByCliente(cliente_id, getRequiredOfficeId(req));
      res.json(pagamentos);
    } catch (err: any) {
      console.error("Erro ao listar pagamentos do cliente:", err);
      res.status(500).json({ error: err.message });
    }
  },

  async buscarPorId(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: "ID inválido." });

      const pagamento = await PagamentosService.getById(id, getRequiredOfficeId(req));
      res.json(pagamento);
    } catch (err: any) {
      if (isNotFound(err)) return res.status(404).json({ message: err.message });
      console.error("Erro ao buscar pagamento:", err);
      res.status(500).json({ error: "Erro interno" });
    }
  },

  async criar(req: Request, res: Response) {
    try {
      const novo = await PagamentosService.create({ ...req.body, oficina_id: getRequiredOfficeId(req) });
      res.status(201).json(novo);
    } catch (err: any) {
      console.error("Erro ao criar pagamento:", err);
      res.status(500).json({ error: err.message });
    }
  },

  async atualizar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: "ID inválido." });

      const atualizado = await PagamentosService.update(id, req.body, getRequiredOfficeId(req));
      res.json(atualizado);
    } catch (err: any) {
      if (isNotFound(err)) return res.status(404).json({ message: err.message });
      console.error("Erro ao atualizar pagamento:", err);
      res.status(400).json({ message: err.message });
    }
  },

  async deletar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: "ID inválido." });

      const resultado = await PagamentosService.delete(id, getRequiredOfficeId(req));
      res.json(resultado);
    } catch (err: any) {
      if (isNotFound(err)) return res.status(404).json({ message: err.message });
      console.error("Erro ao excluir pagamento:", err);
      res.status(500).json({ error: "Erro interno" });
    }
  },

  async extrato(req: Request, res: Response) {
    try {
      const oficina_id = getRequiredOfficeId(req);

      const from = req.query.from?.toString();
      const to = req.query.to?.toString();

      const extrato = await PagamentosService.extrato(oficina_id, from, to);
      res.json(extrato);
    } catch (err: any) {
      console.error("Erro ao gerar extrato:", err);
      res.status(500).json({ error: err.message });
    }
  },
};
