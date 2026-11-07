import api from "../../../api/api";

export type Maquininha = {
  id: number;
  nome: string;
  operadora: string | null;
  ativo: boolean;
  aceita_debito: boolean;
  aceita_credito: boolean;
  taxa_debito: number;
  prazo_debito_dias: number;
  /** [0] = crédito à vista (1x), [1] = 2x... O tamanho é o máximo de parcelas. */
  taxas_credito: number[];
  prazo_credito_dias: number;
  antecipacao: boolean;
};

export type MaquininhaForm = Omit<Maquininha, "id">;

export const MAX_PARCELAS = 18;

/** Operadoras comuns. A cor identifica a operadora na lista (sem logo das marcas). */
export const OPERADORAS: { value: string; label: string; cor: string }[] = [
  { value: "stone", label: "Stone", cor: "#00A868" },
  { value: "cielo", label: "Cielo", cor: "#0083CA" },
  { value: "rede", label: "Rede", cor: "#E35205" },
  { value: "getnet", label: "Getnet", cor: "#E2001A" },
  { value: "pagseguro", label: "PagSeguro", cor: "#1BB99A" },
  { value: "mercadopago", label: "Mercado Pago", cor: "#00A1E4" },
  { value: "infinitepay", label: "InfinitePay", cor: "#3C3C3C" },
  { value: "ton", label: "Ton", cor: "#00C86F" },
  { value: "sumup", label: "SumUp", cor: "#1A1A1A" },
  { value: "safrapay", label: "SafraPay", cor: "#00205B" },
];

export const operadora = (valor?: string | null) => OPERADORAS.find((o) => o.value === valor) ?? null;

export const novaMaquininha = (): MaquininhaForm => ({
  nome: "",
  operadora: null,
  ativo: true,
  aceita_debito: true,
  aceita_credito: true,
  taxa_debito: 0,
  prazo_debito_dias: 1,
  taxas_credito: Array(12).fill(0),
  prazo_credito_dias: 30,
  antecipacao: false,
});

/** Só as ativas (para receber); `todas` traz as inativas também (para configurar). */
export async function listarMaquininhas(todas = false) {
  const { data } = await api.get<Maquininha[]>("/configuracoes/maquininhas", { params: todas ? { todas: "true" } : undefined });
  return data;
}

export async function criarMaquininha(m: MaquininhaForm) {
  const { data } = await api.post<Maquininha>("/configuracoes/maquininhas", m);
  return data;
}

export async function atualizarMaquininha(id: number, m: Partial<MaquininhaForm>) {
  const { data } = await api.put<Maquininha>(`/configuracoes/maquininhas/${id}`, m);
  return data;
}

export async function excluirMaquininha(id: number) {
  await api.delete(`/configuracoes/maquininhas/${id}`);
}

/** "1,5%". */
export const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** Resumo de uma linha: "Débito 1,5% · Crédito 3% à vista, até 12x" ou "Só crédito · 3% à vista, até 12x". */
export function resumoTaxas(m: Pick<Maquininha, "taxa_debito" | "taxas_credito" | "aceita_debito" | "aceita_credito">) {
  const max = m.taxas_credito.length;
  const credito = `${pct(m.taxas_credito[0] ?? 0)} à vista${max > 1 ? `, até ${max}x` : ""}`;
  if (!m.aceita_credito) return `Só débito · ${pct(m.taxa_debito)}`;
  if (!m.aceita_debito) return `Só crédito · ${credito}`;
  return `Débito ${pct(m.taxa_debito)} · Crédito ${credito}`;
}

/** A maquininha aceita esse método de pagamento? */
export const aceitaMetodo = (m: Pick<Maquininha, "aceita_debito" | "aceita_credito">, metodo: string) =>
  metodo === "cartao_debito" ? m.aceita_debito : metodo === "cartao_credito" ? m.aceita_credito : false;
