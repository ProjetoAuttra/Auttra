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
