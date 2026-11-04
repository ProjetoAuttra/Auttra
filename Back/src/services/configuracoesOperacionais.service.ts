import { prisma } from "../prisma/client.js";
import { HttpError } from "../utils/httpError.js";

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

export const DEFAULT_AGENDA_CONFIG: AgendaConfig = {
  horarioInicio: "08:00",
  horarioFim: "18:00",
  dias: "Segunda a Sábado",
  tempoMedio: "60 minutos",
};

export const DEFAULT_FINANCEIRO_CONFIG: FinanceiroConfig = {
  formasPagamento: "Pix, Cartão, Dinheiro",
  emitirRecibos: true,
  jurosAtraso: "2%",
};

function str(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeAgendaConfig(value: unknown): AgendaConfig {
  const input = value && typeof value === "object" ? (value as any) : {};
  const defaults = DEFAULT_AGENDA_CONFIG;

  return {
    horarioInicio: str(input.horarioInicio, defaults.horarioInicio),
    horarioFim: str(input.horarioFim, defaults.horarioFim),
    dias: str(input.dias, defaults.dias),
    tempoMedio: str(input.tempoMedio, defaults.tempoMedio),
  };
}

export function normalizeFinanceiroConfig(value: unknown): FinanceiroConfig {
  const input = value && typeof value === "object" ? (value as any) : {};
  const defaults = DEFAULT_FINANCEIRO_CONFIG;

  return {
    formasPagamento: str(input.formasPagamento, defaults.formasPagamento),
    emitirRecibos: bool(input.emitirRecibos, defaults.emitirRecibos),
    jurosAtraso: str(input.jurosAtraso, defaults.jurosAtraso),
  };
}

export type DocumentosConfig = {
  /** Prazo de garantia dos serviços e peças, em dias. Nunca menor que a garantia legal (90 dias, art. 26, II, do CDC). */
  garantiaDias: number;
  /** Validade que o novo orçamento já traz preenchida (o usuário pode trocar em cada orçamento). */
  validadeOrcamentoDias: number;
  /** Texto livre que sai nos termos do orçamento e da OS. */
  observacoes: string;
};

export const GARANTIA_MINIMA_DIAS = 90;
export const GARANTIA_MAXIMA_DIAS = 3650;
export const VALIDADE_MAXIMA_DIAS = 365;
export const OBSERVACOES_MAX_CARACTERES = 1000;

export const DEFAULT_DOCUMENTOS_CONFIG: DocumentosConfig = {
  garantiaDias: GARANTIA_MINIMA_DIAS,
  validadeOrcamentoDias: 7,
  observacoes: "",
};

const inteiroEntre = (value: unknown, min: number, max: number) => {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** Leitura tolerante: valor ausente ou inválido no banco cai no padrão. */
export function normalizeDocumentosConfig(value: unknown): DocumentosConfig {
  const input = value && typeof value === "object" ? (value as any) : {};
  const defaults = DEFAULT_DOCUMENTOS_CONFIG;
  return {
    garantiaDias: inteiroEntre(input.garantiaDias, GARANTIA_MINIMA_DIAS, GARANTIA_MAXIMA_DIAS) ?? defaults.garantiaDias,
    validadeOrcamentoDias: inteiroEntre(input.validadeOrcamentoDias, 1, VALIDADE_MAXIMA_DIAS) ?? defaults.validadeOrcamentoDias,
    observacoes: typeof input.observacoes === "string" ? input.observacoes.trim().slice(0, OBSERVACOES_MAX_CARACTERES) : defaults.observacoes,
  };
}

/** Gravação estrita: recusa com 400 o que a leitura tolerante descartaria em silêncio. */
export function validarDocumentosConfig(value: unknown): DocumentosConfig {
  const input = value && typeof value === "object" ? (value as any) : {};
  const garantiaDias = inteiroEntre(input.garantiaDias, GARANTIA_MINIMA_DIAS, GARANTIA_MAXIMA_DIAS);
  if (garantiaDias === null) {
    throw new HttpError(
      `O prazo de garantia deve ser um número inteiro de ${GARANTIA_MINIMA_DIAS} a ${GARANTIA_MAXIMA_DIAS} dias (a garantia legal é de 90 dias).`,
      400,
      "GARANTIA_INVALIDA"
    );
  }
  const validadeOrcamentoDias = inteiroEntre(input.validadeOrcamentoDias, 1, VALIDADE_MAXIMA_DIAS);
  if (validadeOrcamentoDias === null) {
    throw new HttpError(`A validade do orçamento deve ser um número inteiro de 1 a ${VALIDADE_MAXIMA_DIAS} dias.`, 400, "VALIDADE_INVALIDA");
  }
  const observacoes = input.observacoes == null ? "" : input.observacoes;
  if (typeof observacoes !== "string" || observacoes.trim().length > OBSERVACOES_MAX_CARACTERES) {
    throw new HttpError(`As observações podem ter até ${OBSERVACOES_MAX_CARACTERES} caracteres.`, 400, "OBSERVACOES_INVALIDAS");
  }
  return { garantiaDias, validadeOrcamentoDias, observacoes: observacoes.trim() };
}

async function findOficina(oficinaId: number) {
  const oficina = await (prisma.oficina as any).findFirst({
    where: { id: oficinaId, deleted_at: null },
    select: { agenda_config: true, financeiro_config: true, documentos_config: true },
  });
  if (!oficina) throw new Error("Oficina nao encontrada.");
  return oficina;
}

export const AgendaConfigService = {
  async get(oficinaId: number) {
    const oficina = await findOficina(oficinaId);
    return normalizeAgendaConfig(oficina.agenda_config);
  },

  async update(oficinaId: number, data: unknown) {
    const config = normalizeAgendaConfig(data);
    await (prisma.oficina as any).update({
      where: { id: oficinaId },
      data: { agenda_config: config },
    });
    return config;
  },
};

export const FinanceiroConfigService = {
  async get(oficinaId: number) {
    const oficina = await findOficina(oficinaId);
    return normalizeFinanceiroConfig(oficina.financeiro_config);
  },

  async update(oficinaId: number, data: unknown) {
    const config = normalizeFinanceiroConfig(data);
    await (prisma.oficina as any).update({
      where: { id: oficinaId },
      data: { financeiro_config: config },
    });
    return config;
  },
};

export const DocumentosConfigService = {
  async get(oficinaId: number) {
    const oficina = await findOficina(oficinaId);
    return normalizeDocumentosConfig(oficina.documentos_config);
  },

  async update(oficinaId: number, data: unknown) {
    const config = validarDocumentosConfig(data);
    await prisma.oficina.update({ where: { id: oficinaId }, data: { documentos_config: config } });
    return config;
  },
};
