export type OrdemStatus = "aberta" | "em_andamento" | "concluida" | "cancelada";

export const STATUS_CONFIG: Record<
  OrdemStatus,
  { label: string; color: "default" | "warning" | "info" | "success" | "error" }
> = {
  aberta: { label: "Aberta", color: "warning" },
  em_andamento: { label: "Em andamento", color: "info" },
  concluida: { label: "Concluída", color: "success" },
  cancelada: { label: "Cancelada", color: "error" },
};

export const STATUS_VALIDOS = Object.keys(STATUS_CONFIG);

// Espelha Back/src/services/ordens.service.ts (VALID_TRANSITIONS) para habilitar/desabilitar
// ações na UI sem depender de tentativa e erro contra a API.
export const VALID_TRANSITIONS: Record<OrdemStatus, OrdemStatus[]> = {
  aberta: ["em_andamento", "cancelada"],
  em_andamento: ["concluida", "cancelada"],
  concluida: [],
  cancelada: [],
};
