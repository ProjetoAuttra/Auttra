import api from "../../../api/api";

export const METODO_OPTIONS = [
  { value: "pix",          label: "PIX" },
  { value: "dinheiro",     label: "Dinheiro" },
  { value: "cartao",       label: "Cartão" },
  { value: "boleto",       label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
];

export const METODO_LABEL: Record<string, string> = Object.fromEntries(
  METODO_OPTIONS.map((m) => [m.value, m.label])
);

export type Conta = {
  id: number;
  tipo: "pagar" | "receber";
  status: "pendente" | "parcial" | "pago" | "cancelado";
  valor: number;
  valor_original: number;
  desconto: number;
  motivo_desconto?: string;
  valor_pago: number;
  data_vencimento: string;
  data_vencimento_original?: string;
  data_pagamento?: string;
  vezes_renegociado: number;
  parcela_numero?: number;
  total_parcelas?: number;
  pagamento_pai_id?: number;
  metodo?: string;
  descricao?: string;
  categoria?: string;
  observacao?: string;
  cliente?: { id: number; nome: string } | null;
  fornecedor?: { id: number; nome: string } | null;
  ordem_servico?: { id: number; status: string } | null;
};

/**
 * Data para exibição. Datas escolhidas num campo de data chegam como meia-noite UTC (ex.: 2026-11-01T00:00:00.000Z)
 * e, lidas no fuso local do Brasil, apareceriam um dia antes; esses valores são tratados como data de calendário.
 * Instantes (ex.: a hora em que o recebimento foi registrado) seguem o fuso local.
 */
export function formatarData(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const soDia = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  return d.toLocaleDateString("pt-BR", soDia ? { timeZone: "UTC" } : undefined);
}

/** Valor para <input type="date"> (YYYY-MM-DD), com a mesma regra de formatarData para meia-noite UTC. */
export function paraInputData(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const soDia = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  if (soDia) return d.toISOString().slice(0, 10);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export const brl = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function isVencido(c: Conta): boolean {
  if (c.status !== "pendente" && c.status !== "parcial") return false;
  const venc = new Date(c.data_vencimento);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return venc < hoje;
}

export function valorLiquido(c: Conta): number {
  return Number(c.valor_original ?? c.valor) - Number(c.desconto ?? 0);
}

export function valorRestante(c: Conta): number {
  return valorLiquido(c) - Number(c.valor_pago ?? 0);
}

export async function listarPagamentos(oficina_id: number) {
  const { data } = await api.get("/pagamentos", { params: { oficina_id } });
  return data as Conta[];
}

export type ResumoContas = {
  total_aberto: number;
  pago_mes: number;
  vencidos: number;
  a_vencer: number;
  qtd_total: number;
  qtd_vencidos: number;
  qtd_pendentes: number;
};

/** Totais dos cards, calculados no servidor sobre todos os títulos do tipo. `hoje` usa a data local do navegador. */
export async function resumoPagamentos(tipo: "receber" | "pagar") {
  const d = new Date();
  const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const { data } = await api.get("/pagamentos/resumo", { params: { tipo, hoje } });
  return data as ResumoContas;
}

export async function criarPagamento(payload: any) {
  const { data } = await api.post("/pagamentos", payload);
  return data as Conta;
}

export async function atualizarPagamento(id: number, payload: any) {
  const { data } = await api.put(`/pagamentos/${id}`, payload);
  return data as Conta;
}

/** Baixa do titulo. Com `valor` menor que o saldo vira recebimento parcial; sem `valor` quita o saldo. */
export async function marcarComoPago(
  id: number,
  payload: { metodo: string; valor?: number; data_pagamento?: string; desconto?: number; motivo_desconto?: string }
) {
  const { data } = await api.post(`/pagamentos/${id}/pagar`, payload);
  return data as Conta;
}

export type Movimento = {
  id: number;
  tipo: "pagamento" | "estorno";
  valor: number | string;
  metodo?: string | null;
  motivo?: string | null;
  estorno_de_id?: number | null;
  created_at: string;
  usuario?: { id: number; nome: string } | null;
};

export async function estornarPagamento(id: number, payload: { motivo: string }) {
  const { data } = await api.post(`/pagamentos/${id}/estornar`, payload);
  return data as Conta;
}

export async function listarMovimentos(id: number) {
  const { data } = await api.get(`/pagamentos/${id}/movimentos`);
  return data as Movimento[];
}

export async function aplicarDesconto(id: number, payload: { desconto: number; motivo_desconto: string }) {
  const { data } = await api.post(`/pagamentos/${id}/desconto`, payload);
  return data as Conta;
}

export async function renegociarPrazo(id: number, payload: { nova_data_vencimento: string }) {
  const { data } = await api.post(`/pagamentos/${id}/renegociar`, payload);
  return data as Conta;
}

export async function parcelar(id: number, payload: { total_parcelas: number; data_primeira_parcela: string; metodo?: string }) {
  const { data } = await api.post(`/pagamentos/${id}/parcelar`, payload);
  return data as { cancelado: number; parcelas: Conta[] };
}

export async function cancelarPagamento(id: number) {
  await api.delete(`/pagamentos/${id}`);
}
