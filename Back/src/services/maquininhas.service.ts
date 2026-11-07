import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma/client.js";
import { HttpError } from "../utils/httpError.js";

/** Operadoras com ícone no front. Qualquer outra fica como "outra" (null). */
export const OPERADORAS = [
  "stone", "cielo", "rede", "getnet", "pagseguro", "mercadopago", "infinitepay", "ton", "sumup", "safrapay",
] as const;

export const MAX_PARCELAS = 18;
const MAX_PRAZO_DIAS = 365;

export const METODOS_CARTAO = ["cartao_credito", "cartao_debito"] as const;
export const ehMetodoCartao = (metodo: unknown): metodo is (typeof METODOS_CARTAO)[number] =>
  METODOS_CARTAO.includes(metodo as any);

export type MaquininhaInput = {
  nome?: unknown;
  operadora?: unknown;
  ativo?: unknown;
  aceita_debito?: unknown;
  aceita_credito?: unknown;
  taxa_debito?: unknown;
  prazo_debito_dias?: unknown;
  taxas_credito?: unknown;
  prazo_credito_dias?: unknown;
  intervalo_parcelas_dias?: unknown;
  antecipacao?: unknown;
};

/** Percentual de 0 a 100 com até 2 casas. Aceita "2,5". */
function percentual(valor: unknown, campo: string) {
  const n = typeof valor === "string" ? Number(valor.replace(",", ".")) : Number(valor);
  if (valor === null || valor === "" || !Number.isFinite(n) || n < 0 || n > 100)
    throw new HttpError(`${campo}: informe um percentual de 0 a 100.`, 400);
  return Math.round(n * 100) / 100;
}

function dias(valor: unknown, campo: string) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 0 || n > MAX_PRAZO_DIAS)
    throw new HttpError(`${campo}: informe um número inteiro de dias, de 0 a ${MAX_PRAZO_DIAS}.`, 400);
  return n;
}

function taxasCredito(valor: unknown) {
  if (!Array.isArray(valor) || valor.length === 0) throw new HttpError("Informe a taxa do crédito à vista.", 400);
  if (valor.length > MAX_PARCELAS) throw new HttpError(`O máximo é de ${MAX_PARCELAS} parcelas.`, 400);
  return valor.map((t, i) => percentual(t, i === 0 ? "Taxa do crédito à vista" : `Taxa do crédito em ${i + 1}x`));
}

/** Valida e normaliza o corpo. `parcial` = edição: só valida o que veio. */
function normalizar(data: MaquininhaInput, parcial: boolean) {
  const out: Prisma.maquininhaUncheckedUpdateInput = {};
  if (!parcial || data.nome !== undefined) {
    const nome = typeof data.nome === "string" ? data.nome.trim() : "";
    if (!nome) throw new HttpError("Informe o nome da maquininha.", 400);
    if (nome.length > 60) throw new HttpError("O nome da maquininha pode ter até 60 caracteres.", 400);
    out.nome = nome;
  }
  if (data.operadora !== undefined) {
    out.operadora = OPERADORAS.includes(data.operadora as any) ? (data.operadora as string) : null;
  }
  if (data.ativo !== undefined) out.ativo = data.ativo !== false;
  if (data.aceita_debito !== undefined) out.aceita_debito = data.aceita_debito !== false;
  if (data.aceita_credito !== undefined) out.aceita_credito = data.aceita_credito !== false;
  if (!parcial || data.taxa_debito !== undefined) out.taxa_debito = percentual(data.taxa_debito ?? 0, "Taxa do débito");
  if (!parcial || data.prazo_debito_dias !== undefined) out.prazo_debito_dias = dias(data.prazo_debito_dias ?? 1, "Prazo do débito");
  if (!parcial || data.taxas_credito !== undefined) out.taxas_credito = taxasCredito(data.taxas_credito ?? [0]);
  if (!parcial || data.prazo_credito_dias !== undefined) out.prazo_credito_dias = dias(data.prazo_credito_dias ?? 30, "Prazo do crédito");
  if (!parcial || data.intervalo_parcelas_dias !== undefined) {
    const intervalo = dias(data.intervalo_parcelas_dias ?? 30, "Intervalo entre parcelas");
    if (intervalo < 1) throw new HttpError("Intervalo entre parcelas: informe pelo menos 1 dia.", 400);
    out.intervalo_parcelas_dias = intervalo;
  }
  if (data.antecipacao !== undefined) out.antecipacao = data.antecipacao === true;
  return out;
}

type Maquininha = Awaited<ReturnType<typeof prisma.maquininha.findFirstOrThrow>>;

/** Decimal → number para o front, e as taxas do crédito sempre como lista de números. */
function serializar(m: Maquininha) {
  return {
    ...m,
    taxa_debito: Number(m.taxa_debito),
    taxas_credito: (Array.isArray(m.taxas_credito) ? m.taxas_credito : [0]).map(Number),
  };
}

const somarDias = (base: Date, n: number) => {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

/**
 * Taxa de um recebimento no cartão, com a configuração atual da maquininha.
 * - Débito: taxa do débito, cai no prazo do débito.
 * - Crédito em N vezes: taxa da posição N-1. Sem antecipação, a 1ª parcela cai no prazo do crédito e as demais
 *   a cada `intervalo_parcelas_dias` (padrão 30); a data prevista é a da última. Com antecipação, cai tudo no prazo do crédito.
 */
export function calcularTaxa(
  maquininha: Pick<Maquininha, "taxa_debito" | "prazo_debito_dias" | "taxas_credito" | "prazo_credito_dias" | "intervalo_parcelas_dias" | "antecipacao">,
  metodo: "cartao_credito" | "cartao_debito",
  parcelas: number,
  valor: Prisma.Decimal,
  dataPagamento: Date
) {
  let percentualTaxa: number;
  let prazo: number;
  if (metodo === "cartao_debito") {
    percentualTaxa = Number(maquininha.taxa_debito);
    prazo = maquininha.prazo_debito_dias;
  } else {
    const taxas = Array.isArray(maquininha.taxas_credito) ? maquininha.taxas_credito.map(Number) : [0];
    if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > taxas.length)
      throw new HttpError(`Esta maquininha aceita de 1 a ${taxas.length} parcelas no crédito.`, 400);
    percentualTaxa = taxas[parcelas - 1];
    prazo = maquininha.antecipacao
      ? maquininha.prazo_credito_dias
      : maquininha.prazo_credito_dias + maquininha.intervalo_parcelas_dias * (parcelas - 1);
  }
  const taxa = new Prisma.Decimal(percentualTaxa);
  return {
    cartao_parcelas: metodo === "cartao_debito" ? 1 : parcelas,
    taxa_percentual: taxa,
    valor_taxa: valor.times(taxa).div(100).toDecimalPlaces(2),
    data_prevista_recebimento: somarDias(dataPagamento, prazo),
  };
}

/** Pelo menos um tipo ligado. `atual` = como está no banco, para a edição parcial. */
function exigeUmTipo(dados: { aceita_debito?: unknown; aceita_credito?: unknown }, atual = { aceita_debito: true, aceita_credito: true }) {
  const debito = dados.aceita_debito ?? atual.aceita_debito;
  const credito = dados.aceita_credito ?? atual.aceita_credito;
  if (!debito && !credito) throw new HttpError("A maquininha precisa aceitar débito, crédito ou os dois.", 400);
}

/** A maquininha aceita esse método? */
export const aceitaMetodo = (m: { aceita_debito: boolean; aceita_credito: boolean }, metodo: "cartao_credito" | "cartao_debito") =>
  metodo === "cartao_debito" ? m.aceita_debito : m.aceita_credito;

export const MaquininhasService = {
  /** Sem `todas`, só as ativas (para o recebimento). */
  async list(oficinaId: number, todas = false) {
    const lista = await prisma.maquininha.findMany({
      where: { oficina_id: oficinaId, deleted_at: null, ...(todas ? {} : { ativo: true }) },
      orderBy: [{ ativo: "desc" }, { nome: "asc" }, { id: "asc" }],
    });
    return lista.map(serializar);
  },

  async get(id: number, oficinaId: number, tx: Prisma.TransactionClient | typeof prisma = prisma) {
    const m = await tx.maquininha.findFirst({ where: { id, oficina_id: oficinaId, deleted_at: null } });
    if (!m) throw new HttpError("Maquininha não encontrada.", 404);
    return m;
  },

  async create(oficinaId: number, data: MaquininhaInput) {
    const dados = normalizar(data ?? {}, false) as Prisma.maquininhaUncheckedCreateInput;
    exigeUmTipo(dados);
    const criada = await prisma.maquininha.create({ data: { ...dados, oficina_id: oficinaId } });
    return serializar(criada);
  },

  async update(id: number, oficinaId: number, data: MaquininhaInput) {
    const atual = await MaquininhasService.get(id, oficinaId);
    const dados = normalizar(data ?? {}, true);
    exigeUmTipo(dados, atual);
    const atualizada = await prisma.maquininha.update({ where: { id }, data: dados });
    return serializar(atualizada);
  },

  /** Exclui só da lista: os recebimentos antigos continuam mostrando a maquininha e a taxa da época. */
  async delete(id: number, oficinaId: number) {
    await MaquininhasService.get(id, oficinaId);
    await prisma.maquininha.update({ where: { id }, data: { deleted_at: new Date(), ativo: false } });
  },
};
