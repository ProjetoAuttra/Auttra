import api from "../../../api/api";

export type AgendaConfig = {
  horarioInicio: string;
  horarioFim: string;
  dias: string;
  tempoMedio: string;
};

export type FinanceiroConfig = {
  formasPagamento: string;
  emitirRecibos: boolean;
  jurosAtraso: string;
};

export const defaultAgendaConfig: AgendaConfig = {
  horarioInicio: "08:00",
  horarioFim: "18:00",
  dias: "Segunda a Sábado",
  tempoMedio: "60 minutos",
};

export const defaultFinanceiroConfig: FinanceiroConfig = {
  formasPagamento: "Pix, Cartão, Dinheiro",
  emitirRecibos: true,
  jurosAtraso: "2%",
};

export async function buscarConfigAgenda() {
  const { data } = await api.get<AgendaConfig>("/configuracoes/agenda");
  return data;
}

export async function salvarConfigAgenda(config: AgendaConfig) {
  const { data } = await api.put<AgendaConfig>("/configuracoes/agenda", config);
  return data;
}

export async function buscarConfigFinanceiro() {
  const { data } = await api.get<FinanceiroConfig>("/configuracoes/financeiro");
  return data;
}

export async function salvarConfigFinanceiro(config: FinanceiroConfig) {
  const { data } = await api.put<FinanceiroConfig>("/configuracoes/financeiro", config);
  return data;
}

/** Orçamentos e OS: prazo de garantia, validade padrão do orçamento e observações dos PDFs. */
export type DocumentosConfig = {
  garantiaDias: number;
  validadeOrcamentoDias: number;
  observacoes: string;
};

/** Garantia legal (art. 26, II, do CDC): a oficina pode dar mais, nunca menos. */
export const GARANTIA_MINIMA_DIAS = 90;
export const GARANTIA_MAXIMA_DIAS = 3650;
export const VALIDADE_MAXIMA_DIAS = 365;
export const OBSERVACOES_MAX_CARACTERES = 1000;

export const defaultDocumentosConfig: DocumentosConfig = {
  garantiaDias: GARANTIA_MINIMA_DIAS,
  validadeOrcamentoDias: 7,
  observacoes: "",
};

export async function buscarConfigDocumentos() {
  const { data } = await api.get<DocumentosConfig>("/configuracoes/documentos");
  return data;
}

export async function salvarConfigDocumentos(config: DocumentosConfig) {
  const { data } = await api.put<DocumentosConfig>("/configuracoes/documentos", config);
  return data;
}

/** Mensagem de erro de cada campo, ou null se o formulário pode ser salvo (espelha a validação do back). */
export function errosDocumentosConfig(c: DocumentosConfig): Partial<Record<keyof DocumentosConfig, string>> | null {
  const erros: Partial<Record<keyof DocumentosConfig, string>> = {};
  if (!Number.isInteger(c.garantiaDias) || c.garantiaDias < GARANTIA_MINIMA_DIAS || c.garantiaDias > GARANTIA_MAXIMA_DIAS) {
    erros.garantiaDias = `Mínimo de ${GARANTIA_MINIMA_DIAS} dias (garantia legal) e máximo de ${GARANTIA_MAXIMA_DIAS}.`;
  }
  if (!Number.isInteger(c.validadeOrcamentoDias) || c.validadeOrcamentoDias < 1 || c.validadeOrcamentoDias > VALIDADE_MAXIMA_DIAS) {
    erros.validadeOrcamentoDias = `De 1 a ${VALIDADE_MAXIMA_DIAS} dias.`;
  }
  if (c.observacoes.trim().length > OBSERVACOES_MAX_CARACTERES) {
    erros.observacoes = `Até ${OBSERVACOES_MAX_CARACTERES} caracteres.`;
  }
  return Object.keys(erros).length ? erros : null;
}
