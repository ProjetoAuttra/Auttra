/**
 * Agenda e Financeiro ainda são guardados como texto livre no back ("Segunda a Sábado", "60 minutos", "2%").
 * Estas funções convertem esse texto para os controles da tela e de volta, sem mudar o formato salvo.
 * Quando o texto não segue o formato esperado (foi digitado à mão antes), o parse devolve null e a tela
 * mostra o campo de texto livre, para não apagar o que a oficina escreveu.
 */

export const DIAS_SEMANA = [
  { curto: "Seg", nome: "Segunda" },
  { curto: "Ter", nome: "Terça" },
  { curto: "Qua", nome: "Quarta" },
  { curto: "Qui", nome: "Quinta" },
  { curto: "Sex", nome: "Sexta" },
  { curto: "Sáb", nome: "Sábado" },
  { curto: "Dom", nome: "Domingo" },
] as const;

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const PREFIXOS_DIA = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

function indiceDoDia(texto: string): number | null {
  const t = normalizar(texto).replace(/-?feira$/, "").replace(/\.$/, "").trim();
  if (!t) return null;
  const i = PREFIXOS_DIA.findIndex((p) => t.startsWith(p));
  if (i < 0) return null;
  // "sexta" e "sex" valem; "segundo" ou "quarto" não.
  const nome = normalizar(DIAS_SEMANA[i].nome);
  return nome.startsWith(t) ? i : null;
}

/** "Segunda a Sábado" → [0..5]; "Segunda, Quarta e Sexta" → [0, 2, 4]. Índices começam na segunda. */
export function lerDiasAtendimento(texto: string): number[] | null {
  const t = normalizar(texto);
  if (!t) return null;
  if (t === "todos os dias") return [0, 1, 2, 3, 4, 5, 6];

  const dias = new Set<number>();
  for (const parte of t.split(/\s*,\s*|\s+e\s+/)) {
    const intervalo = parte.split(/\s+a\s+/);
    if (intervalo.length === 2) {
      const ini = indiceDoDia(intervalo[0]);
      const fim = indiceDoDia(intervalo[1]);
      if (ini === null || fim === null) return null;
      for (let i = ini; ; i = (i + 1) % 7) {
        dias.add(i);
        if (i === fim) break;
      }
    } else if (intervalo.length === 1) {
      const dia = indiceDoDia(parte);
      if (dia === null) return null;
      dias.add(dia);
    } else {
      return null;
    }
  }
  return [...dias].sort((a, b) => a - b);
}

/** [0..5] → "Segunda a Sábado"; [0, 2, 4] → "Segunda, Quarta e Sexta". */
export function escreverDiasAtendimento(dias: number[]): string {
  const ordenados = [...new Set(dias)].sort((a, b) => a - b);
  if (ordenados.length === 0) return "";
  if (ordenados.length === 7) return "Todos os dias";

  // Agrupa dias seguidos: três ou mais viram "X a Y".
  const grupos: number[][] = [];
  for (const d of ordenados) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo[ultimo.length - 1] === d - 1) ultimo.push(d);
    else grupos.push([d]);
  }
  const partes = grupos.flatMap((g) =>
    g.length >= 3 ? [`${DIAS_SEMANA[g[0]].nome} a ${DIAS_SEMANA[g[g.length - 1]].nome}`] : g.map((d) => DIAS_SEMANA[d].nome)
  );
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

/** "60 minutos" → 60; "1 hora e 30 minutos" → 90; "1h30" → 90; "45" → 45. */
export function lerMinutos(texto: string): number | null {
  const t = normalizar(texto);
  const m = t.match(/^(?:(\d+)\s*(?:h|hr|hrs|hora|horas)\s*(?:e\s*)?)?(?:(\d+)\s*(?:m|min|mins|minuto|minutos)?)?$/);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
}

export const escreverMinutos = (minutos: number) => `${minutos} ${minutos === 1 ? "minuto" : "minutos"}`;

/** "2%" → 2; "2,5 %" → 2.5. */
export function lerPercentual(texto: string): number | null {
  const m = normalizar(texto).match(/^(\d+(?:[.,]\d+)?)\s*%?$/);
  return m ? Number(m[1].replace(",", ".")) : null;
}

export const escreverPercentual = (valor: number) => `${String(valor).replace(".", ",")}%`;

export const FORMAS_PAGAMENTO_SUGERIDAS = ["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Boleto", "Transferência"];

/** "Pix, Cartão, Dinheiro" → ["Pix", "Cartão", "Dinheiro"]. */
export const lerFormasPagamento = (texto: string) =>
  texto
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

export const escreverFormasPagamento = (formas: string[]) => formas.map((s) => s.trim()).filter(Boolean).join(", ");

/** "08:00" → true. O campo de horário do navegador só entende HH:mm. */
export const ehHorario = (texto: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(texto.trim());
