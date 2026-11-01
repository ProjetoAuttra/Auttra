export function maskCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function maskCpf(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function maskTelefone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}

export function maskCep(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

// ─── Moeda ─────────────────────────────────────────────────────────────────
// Máscara de dinheiro: os dígitos entram pela direita (centavos), então "1234" vira "12,34".
// Campo de texto (não type="number"): a roda do mouse não muda o valor e a vírgula funciona em qualquer navegador.

export function formatPreco(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return (parseFloat(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parsePreco(formatted: string): number {
  return parseFloat(formatted.replace(/\./g, "").replace(",", ".")) || 0;
}

/** Número em reais para o texto do campo com máscara (ex.: 1234.5 → "1.234,50"); zero ou negativo vira vazio. */
export function precoParaCampo(valor: number): string {
  return valor > 0 ? formatPreco(String(Math.round(valor * 100))) : "";
}

// ─── Decimal (ex.: percentual) ─────────────────────────────────────────────

/** Mantém só dígitos e um separador decimal; aceita vírgula ou ponto e mostra vírgula. */
export function maskDecimal(raw: string, casas = 2): string {
  const limpo = raw.replace(/[^\d.,]/g, "").replace(".", ",");
  const [inteiro, ...resto] = limpo.split(",");
  if (resto.length === 0) return inteiro;
  return `${inteiro},${resto.join("").replace(/\D/g, "").slice(0, casas)}`;
}

export function parseDecimal(texto: string): number {
  return parseFloat(texto.replace(/\./g, "").replace(",", ".")) || 0;
}
