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

export async function criarPagamento(payload: any) {
  const { data } = await api.post("/pagamentos", payload);
  return data as Conta;
}

export async function atualizarPagamento(id: number, payload: any) {
  const { data } = await api.put(`/pagamentos/${id}`, payload);
  return data as Conta;
}

export async function marcarComoPago(id: number, payload: { metodo: string; data_pagamento?: string }) {
  const { data } = await api.post(`/pagamentos/${id}/pagar`, payload);
  return data as Conta;
}

export async function registrarParcial(id: number, payload: { valor_entrada: number; metodo: string }) {
  const { data } = await api.post(`/pagamentos/${id}/pagamento-parcial`, payload);
  return data as Conta;
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
