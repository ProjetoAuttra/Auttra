const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

/** 1 a 999 por extenso. */
function ate999(n: number): string {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (resto) partes.push(resto < 20 ? UNIDADES[resto] : DEZENAS[Math.floor(resto / 10)] + (resto % 10 ? ` e ${UNIDADES[resto % 10]}` : ""));
  return partes.join(" e ");
}

const ESCALAS: Array<[string, string]> = [
  ["", ""],
  ["mil", "mil"],
  ["milhão", "milhões"],
  ["bilhão", "bilhões"],
];

/** Inteiro de 0 a 999.999.999.999 por extenso (sem a palavra "reais"). */
function inteiro(n: number): string {
  if (n === 0) return "zero";
  const grupos: number[] = [];
  for (let resto = n; resto > 0; resto = Math.floor(resto / 1000)) grupos.push(resto % 1000);

  const partes: Array<{ texto: string; valor: number }> = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i];
    if (!g) continue;
    const [singular, plural] = ESCALAS[i];
    let texto: string;
    if (i === 1) texto = g === 1 ? "mil" : `${ate999(g)} mil`;
    else if (i >= 2) texto = `${ate999(g)} ${g === 1 ? singular : plural}`;
    else texto = ate999(g);
    partes.push({ texto, valor: g });
  }

  // "e" entre os grupos só quando o último é menor que 100 ou centena exata ("mil e duzentos", "mil duzentos e trinta").
  return partes.reduce((acc, p, idx) => {
    if (idx === 0) return p.texto;
    const ultimo = idx === partes.length - 1;
    return acc + (ultimo && (p.valor < 100 || p.valor % 100 === 0) ? " e " : " ") + p.texto;
  }, "");
}

/** Valor em reais por extenso, ex.: 1200 -> "mil e duzentos reais"; 1.5 -> "um real e cinquenta centavos". */
export function valorPorExtenso(valor: number): string {
  const centavosTotais = Math.round(Math.abs(valor) * 100);
  const reais = Math.floor(centavosTotais / 100);
  const centavos = centavosTotais % 100;

  const partes: string[] = [];
  if (reais > 0 || centavos === 0) {
    const redondoMilhao = reais >= 1_000_000 && reais % 1_000_000 === 0;
    partes.push(`${inteiro(reais)}${redondoMilhao ? " de" : ""} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) partes.push(`${inteiro(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  return partes.join(" e ");
}
