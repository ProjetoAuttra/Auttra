/** Espelha Back/src/utils/quantidade.ts: até 3 casas decimais, até 99999. */
export const QUANTIDADE_MAXIMA = 99999;

export const UNIDADES = [
  { value: "UN", label: "Unidade (UN)" },
  { value: "L", label: "Litro (L)" },
  { value: "KG", label: "Quilo (KG)" },
  { value: "M", label: "Metro (M)" },
] as const;

/** "3,5" ou "3.5" → 3.5. Texto vazio, inválido, com mais de 3 casas ou acima do máximo → null. */
export function lerQuantidade(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null;
  const n = Number(t);
  return n > QUANTIDADE_MAXIMA ? null : n;
}

/** Quantidade da API (Decimal chega como string, ex.: "3.5") em pt-BR: "3,5 L", "2". */
export function formatarQuantidade(q: unknown, unidade?: string | null) {
  const n = Number(q ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  return unidade ? `${n} ${unidade}` : n;
}

/** Número para o texto do campo: 3.5 → "3,5". */
export const quantidadeParaTexto = (n: unknown) => formatarQuantidade(n).replace(/\./g, "");
