import type { NextFunction, Request, Response } from "express";
import { AssinaturaService } from "../services/assinatura.service.js";
import { getRequiredOfficeId } from "./ensureAuth.js";

/** Código do 402 de escrita bloqueada: o front abre o diálogo "Assine para continuar". */
export const ASSINATURA_NECESSARIA = "ASSINATURA_NECESSARIA";

const METODOS_LEITURA = new Set(["GET", "HEAD", "OPTIONS"]);

// Liberadas mesmo fora do prazo: relatórios só consultam, sugestão é o canal com a gente
// e a própria assinatura precisa responder.
const ROTAS_LIVRES = ["/relatorios", "/sugestoes", "/assinatura"];

const livre = (path: string) => ROTAS_LIVRES.some((rota) => path === rota || path.startsWith(`${rota}/`));

/**
 * Conta só leitura: depois do teste ou com a assinatura suspensa, a oficina vê tudo,
 * mas não cria, altera nem exclui. Roda depois do officeScopeMiddleware.
 */
export const assinaturaMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (METODOS_LEITURA.has(req.method) || livre(req.path)) return next();

  const assinatura = await AssinaturaService.daOficina(getRequiredOfficeId(req));
  if (!assinatura?.somenteLeitura) return next();

  return res.status(402).json({
    message:
      assinatura.situacao === "suspensa"
        ? "Sua assinatura está suspensa. Fale com a gente para voltar a criar e editar."
        : "Seu teste grátis terminou. Assine para voltar a criar e editar.",
    code: ASSINATURA_NECESSARIA,
    situacao: assinatura.situacao,
  });
};
