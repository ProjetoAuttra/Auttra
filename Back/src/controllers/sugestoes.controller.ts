import { Request, Response } from "express";
import { z } from "zod";
import { getRequiredOfficeId } from "../middlewares/ensureAuth.js";
import { MODULOS_SUGESTAO, SugestoesService } from "../services/sugestoes.service.js";

const criarSugestaoSchema = z.object({
  modulo: z.enum(Object.keys(MODULOS_SUGESTAO) as [keyof typeof MODULOS_SUGESTAO, ...(keyof typeof MODULOS_SUGESTAO)[]], {
    message: "Selecione o módulo.",
  }),
  mensagem: z.string().trim()
    .min(10, "Escreva sua sugestão com pelo menos 10 caracteres.")
    .max(2000, "A sugestão deve ter no máximo 2000 caracteres."),
});

export const SugestoesController = {
  async criar(req: Request, res: Response) {
    const parsed = criarSugestaoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Dados inválidos." });
    }

    try {
      const sugestao = await SugestoesService.criar({
        oficinaId: getRequiredOfficeId(req),
        usuarioId: req.user!.id,
        ...parsed.data,
      });
      return res.status(201).json(sugestao);
    } catch (err) {
      console.error("Erro ao registrar sugestão:", err);
      return res.status(500).json({ message: "Não foi possível enviar sua sugestão." });
    }
  },
};
