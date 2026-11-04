import { Prisma } from "@prisma/client";
import { HttpError } from "./httpError.js";

export const QUANTIDADE_MAXIMA = 99999;
export const UNIDADES = ["UN", "L", "KG", "M"] as const;
export type Unidade = (typeof UNIDADES)[number];

const invalida = () => new HttpError("Quantidade inválida.", 400, "QUANTIDADE_INVALIDA");

/**
 * Converte a quantidade vinda do cliente (número, texto com vírgula ou Decimal) em Decimal.
 * Aceita até 3 casas e até 99999. Zero só vale quando `permitirZero` (ex.: estoque da peça).
 */
export function parseQuantidade(v: unknown, permitirZero = false): Prisma.Decimal {
  const texto =
    typeof v === "number" ? (Number.isFinite(v) ? String(v) : "")
    : typeof v === "string" ? v.trim().replace(",", ".")
    : Prisma.Decimal.isDecimal(v) ? v.toString()
    : "";
  if (!/^\d+(\.\d{1,3})?$/.test(texto)) throw invalida();
  const qtd = new Prisma.Decimal(texto);
  if ((permitirZero ? qtd.lt(0) : qtd.lte(0)) || qtd.gt(QUANTIDADE_MAXIMA)) throw invalida();
  return qtd;
}

export function parseUnidade(v: unknown): Unidade {
  const unidade = String(v ?? "").trim().toUpperCase();
  if (!(UNIDADES as readonly string[]).includes(unidade)) {
    throw new HttpError("Unidade inválida. Use UN, L, KG ou M.", 400, "UNIDADE_INVALIDA");
  }
  return unidade as Unidade;
}

/** Unidade comercial da NF-e (uCom) para a nossa; o que não reconhece vira UN. */
export function unidadeDaNota(uCom: unknown): Unidade {
  const u = String(uCom ?? "").trim().toUpperCase();
  if (["L", "LT", "LTS", "LITRO", "LITROS"].includes(u)) return "L";
  if (["KG", "KGS", "QUILO", "QUILOS"].includes(u)) return "KG";
  if (["M", "MT", "MTS", "METRO", "METROS"].includes(u)) return "M";
  return "UN";
}

/** "3,5 L", "2 UN", "1.234,5": formato pt-BR para PDF, mensagens e notificações. */
export function formatarQuantidade(q: unknown, unidade?: string | null) {
  const n = Number(q ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  return unidade ? `${n} ${unidade}` : n;
}
