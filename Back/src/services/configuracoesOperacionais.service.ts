import { prisma } from "../prisma/client.js";

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

async function findOficina(oficinaId: number) {
  const oficina = await (prisma.oficina as any).findFirst({
    where: { id: oficinaId, deleted_at: null },
    select: { agenda_config: true, financeiro_config: true },
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
