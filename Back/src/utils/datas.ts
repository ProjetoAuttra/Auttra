/** Fuso em que as oficinas trabalham: "hoje" e os vencimentos seguem o dia daqui, não o de UTC. */
export const FUSO_OFICINA = "America/Sao_Paulo";

/** Dia de hoje em São Paulo, no formato YYYY-MM-DD. */
export function hojeISO(agora: Date = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: FUSO_OFICINA });
}

// O Brasil não tem mais horário de verão (desde 2019): São Paulo é sempre UTC-3.
const OFFSET_SP = "-03:00";

/** Início (00:00) do dia YYYY-MM-DD em São Paulo, como instante. */
export function inicioDoDiaSP(iso: string): Date {
  return new Date(`${iso}T00:00:00.000${OFFSET_SP}`);
}

/** Último instante (23:59:59.999) do dia YYYY-MM-DD em São Paulo: "vale até o fim do dia". */
export function fimDoDiaSP(iso: string): Date {
  return new Date(`${iso}T23:59:59.999${OFFSET_SP}`);
}

/** Data sem hora, gravada como o formulário de contas grava: meia-noite UTC do dia informado. */
export function dataDoDia(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}
