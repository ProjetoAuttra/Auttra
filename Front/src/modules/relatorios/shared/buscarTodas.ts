import api from "../../../api/api";

/** Tamanho de página pedido ao servidor (o backend aceita no máximo 100 por página). */
export const LINHAS_POR_PAGINA = 100;
/** Quantas páginas são pedidas ao mesmo tempo depois da primeira. */
const PARALELAS = 4;

type Params = Record<string, string | number | boolean | null | undefined>;

/** Valores vazios não vão para a query. */
function limpar(params: Params) {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
}

/**
 * Traz todos os registros de uma listagem paginada (page/limit + header X-Total-Count).
 * Sem paginação, as listagens param no teto do servidor (LIMITE_LISTAGEM); os relatórios feitos no cliente
 * precisam de todos os registros relevantes, então pedem página a página até completar o total.
 * Se o endpoint não informar o total (não pagina), fica só com a primeira resposta.
 */
export async function buscarTodas<T>(endpoint: string, params: Params = {}): Promise<T[]> {
  const base = limpar(params);
  const pagina = (page: number) => api.get<T[]>(endpoint, { params: { ...base, page, limit: LINHAS_POR_PAGINA } });

  const primeira = await pagina(1);
  const linhas = [...(primeira.data ?? [])];
  const total = Number(primeira.headers?.["x-total-count"]);
  if (!Number.isFinite(total)) return linhas;

  const paginas = Math.ceil(total / LINHAS_POR_PAGINA);
  for (let inicio = 2; inicio <= paginas; inicio += PARALELAS) {
    const lote = [];
    for (let p = inicio; p < inicio + PARALELAS && p <= paginas; p++) lote.push(pagina(p));
    for (const res of await Promise.all(lote)) linhas.push(...(res.data ?? []));
  }

  // Um registro criado no meio da busca desloca as páginas e pode repetir uma linha.
  const vistos = new Set<unknown>();
  return linhas.filter((l: any) => {
    if (l?.id === undefined) return true;
    if (vistos.has(l.id)) return false;
    vistos.add(l.id);
    return true;
  });
}

/** Desloca um dia (YYYY-MM-DD) em `dias`; usado para pedir ao servidor uma janela com folga e filtrar o dia exato no cliente. */
export function somarDias(dia: string, dias: number) {
  const d = new Date(`${dia}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return dia;
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
