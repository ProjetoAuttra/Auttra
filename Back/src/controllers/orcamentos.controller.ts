import { Request, Response } from "express";
import { OrcamentoService } from "../services/orcamentos.service.js";
import { PdfHtmlService } from "../services/pdfservice.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";

const service = new OrcamentoService();

export class OrcamentoController {
  async listar(req: Request, res: Response) {
    const data = await service.listarTodos(getRequiredOfficeId(req));
    return res.json(data);
  }

  async buscar(req: Request, res: Response) {
    const id = Number(req.params.id);
    const data = await service.buscarPorId(id, getRequiredOfficeId(req));

    if (!data) return res.status(404).json({ message: "Orçamento não encontrado" });

    return res.json(data);
  }

  async criar(req: Request, res: Response) {
    const body = req.body;
    const novo = await service.criar({ ...body, oficinaId: getRequiredOfficeId(req) });
    return res.status(201).json(novo);
  }

  async atualizar(req: Request, res: Response) {
    const id = Number(req.params.id);
    const atualizado = await service.atualizar(id, req.body, getRequiredOfficeId(req));
    return res.json(atualizado);
  }

  async atualizarStatus(req: Request, res: Response) {
    const id = Number(req.params.id);
    const { status } = req.body;

    const atualizado = await service.atualizarStatus(id, status, getRequiredOfficeId(req));
    return res.json(atualizado);
  }

  async excluir(req: Request, res: Response) {
    const id = Number(req.params.id);
    await service.excluir(id, getRequiredOfficeId(req));
    return res.status(204).send();
  }

  async gerarPdf(req: Request, res: Response) {
    try {
      await PdfHtmlService.gerarOrcamentoPDF(
        Number(req.params.id),
        res,
        getRequiredOfficeId(req)
      );
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
