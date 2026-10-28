import { Request, Response } from "express";
import { z } from "zod";
import { MODULOS_SUGESTAO, SugestoesService } from "../../services/sugestoes.service.js";

// Datas do filtro chegam como dia (AAAA-MM-DD) no horario de Brasilia; "ate" inclui o dia inteiro.
const FUSO_BRASILIA = "-03:00";
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00${FUSO_BRASILIA}`).getTime()), "Data inválida.");

const filtrosSchema = z.object({
  modulo: z.enum(Object.keys(MODULOS_SUGESTAO) as [keyof typeof MODULOS_SUGESTAO, ...(keyof typeof MODULOS_SUGESTAO)[]], {
    message: "Módulo inválido.",
  }).optional(),
  oficina_id: z.coerce.number().int().positive().optional(),
  de: dia.optional(),
  ate: dia.optional(),
  q: z.string().trim().max(100).optional(),
  ordem: z.enum(["desc", "asc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const SugestoesAdminController = {
  async listar(req: Request, res: Response) {
    const parsed = filtrosSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Filtros inválidos." });
    }
    const { de, ate, q, oficina_id, ...resto } = parsed.data;
    if (de && ate && de > ate) {
      return res.status(400).json({ message: "A data inicial deve ser anterior à final." });
    }

    try {
      const fimDoDia = ate ? new Date(`${ate}T00:00:00${FUSO_BRASILIA}`) : undefined;
      fimDoDia?.setUTCDate(fimDoDia.getUTCDate() + 1);
      return res.json(await SugestoesService.listar({
        ...resto,
        q: q || undefined,
        oficinaId: oficina_id,
        de: de ? new Date(`${de}T00:00:00${FUSO_BRASILIA}`) : undefined,
        ate: fimDoDia,
      }));
    } catch (err) {
      console.error("Erro ao listar sugestões:", err);
      return res.status(500).json({ message: "Erro interno." });
    }
  },
};
