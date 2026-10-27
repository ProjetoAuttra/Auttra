import type { Request, Response } from "express";
import { LIMITE_LISTAGEM } from "./limites.js";

export type Paginacao = { page: number; limit: number; skip: number };

const LIMITE_MAXIMO_PAGINA = 100;

/** Lê ?page= e ?limit=. Sem nenhum dos dois, a listagem segue sem paginação (compatível com relatórios e autocompletes). */
export function parsePaginacao(query: Request["query"]): Paginacao | null {
  if (query.page === undefined && query.limit === undefined) return null;
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);
  const limit = Math.min(LIMITE_MAXIMO_PAGINA, Math.max(1, Math.floor(Number(query.limit)) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export type ResultadoLista<T> = { rows: T[]; total: number };

/**
 * Busca uma página (com contagem total) ou, sem paginação, até `take` linhas.
 * `take` permite manter tetos menores já existentes, como os 20 resultados de uma busca de autocomplete.
 */
export async function listarPaginado<T>(
  pag: Paginacao | null,
  fonte: { find: (p: { skip: number; take: number }) => Promise<T[]>; count: () => Promise<number> },
  take: number = LIMITE_LISTAGEM
): Promise<ResultadoLista<T>> {
  if (!pag) {
    const rows = await fonte.find({ skip: 0, take });
    return { rows, total: rows.length };
  }
  const [rows, total] = await Promise.all([fonte.find({ skip: pag.skip, take: pag.limit }), fonte.count()]);
  return { rows, total };
}

/** Responde o array e informa o total no header, que o CORS precisa expor ao front. */
export function responderLista<T>(res: Response, { rows, total }: ResultadoLista<T>) {
  res.setHeader("X-Total-Count", String(total));
  return res.json(rows);
}

export function textoQuery(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}
