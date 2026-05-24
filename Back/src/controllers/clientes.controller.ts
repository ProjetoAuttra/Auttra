import { Request, Response } from "express";
import { ClienteService } from "../services/clientes.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { Prisma } from "@prisma/client";

function isNotFound(err: any): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  return msg.includes("nao encontrado") || msg.includes("não encontrado");
}

export const clienteController = {

  async listar(req: Request, res: Response) {
    try {
      const search = req.query.search ? String(req.query.search) : "";
      const clientes = await ClienteService.listar(getRequiredOfficeId(req), search);
      return res.json(clientes);
    } catch (err: any) {
      console.error("Erro ao listar clientes:", err);
      return res.status(500).json({ error: err.message });
    }
  },

  async getDetalhes(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const cliente = await ClienteService.getDetalhes(id, getRequiredOfficeId(req));
      return res.json(cliente);
    } catch (err: any) {
      if (isNotFound(err)) return res.status(404).json({ message: err.message });
      console.error("Erro ao obter detalhes do cliente:", err);
      return res.status(500).json({ error: "Erro interno" });
    }
  },

  async criar(req: Request, res: Response) {
    try {
      const cliente = await ClienteService.criar({
        ...req.body,
        oficina_id: getRequiredOfficeId(req),
      });
      return res.status(201).json(cliente);
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return res.status(409).json({ message: "Ja existe um cliente com este CPF/CNPJ ou e-mail nesta oficina." });
      }
      console.error("Erro ao criar cliente:", err);
      return res.status(400).json({ message: err.message });
    }
  },

  async atualizar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const cliente = await ClienteService.atualizar(id, req.body, getRequiredOfficeId(req));
      return res.json(cliente);
    } catch (err: any) {
      if (isNotFound(err)) return res.status(404).json({ message: err.message });
      console.error("Erro ao atualizar cliente:", err);
      return res.status(400).json({ message: err.message });
    }
  },

  async deletar(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await ClienteService.deletar(id, getRequiredOfficeId(req));
      return res.status(204).send();
    } catch (err: any) {
      console.error("Erro ao deletar cliente:", err);
      return res.status(400).json({ message: err.message });
    }
  },

  async listarVeiculosDoCliente(req: Request, res: Response) {
    try {
      const clienteId = Number(req.params.clienteId);
      const veiculos = await ClienteService.listarVeiculosDoCliente(clienteId, getRequiredOfficeId(req));
      return res.json(veiculos);
    } catch (err: any) {
      console.error("Erro ao buscar veiculos do cliente:", err);
      return res.status(500).json({ error: "Erro ao buscar veiculos do cliente" });
    }
  },
};
