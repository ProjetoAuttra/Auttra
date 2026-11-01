/** Fuso em que as oficinas trabalham: "hoje" e os vencimentos seguem o dia daqui, não o de UTC. */
export const FUSO_OFICINA = "America/Sao_Paulo";

/** Dia de hoje em São Paulo, no formato YYYY-MM-DD. */
export function hojeISO(agora: Date = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: FUSO_OFICINA });
}

/** Data sem hora, gravada como o formulário de contas grava: meia-noite UTC do dia informado. */
export function dataDoDia(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}
