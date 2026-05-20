import { Request, Response } from "express";
import { ImportacaoXmlService } from "../services/importacaoXml.service.js";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";

export const ImportacaoXmlController = {
  async preview(req: Request, res: Response) {
    try {
      const oficinaId = getRequiredOfficeId(req);

      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo foi enviado." });
      }

      const preview = await ImportacaoXmlService.gerarPreview(req.file.buffer, oficinaId);
      return res.json(preview);
    } catch (error: unknown) {
      console.error("Erro ao gerar preview do XML:", error);
      const msg = error instanceof Error ? error.message : "Não foi possível processar o arquivo.";
      return res.status(422).json({ error: msg });
    }
  },

  async confirmar(req: Request, res: Response) {
    try {
      const oficinaId = getRequiredOfficeId(req);
      const resultado = await ImportacaoXmlService.confirmar(req.body, oficinaId);
      return res.json(resultado);
    } catch (error: unknown) {
      console.error("Erro ao confirmar importação do XML:", error);
      const msg = error instanceof Error ? error.message : "Não foi possível confirmar a importação.";
      return res.status(422).json({ error: msg });
    }
  },
};
