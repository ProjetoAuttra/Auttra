import api from "../../api/api";

export type NotificationSeverity = "info" | "success" | "warning" | "danger";
export type NotificationType = "agenda" | "financeiro" | "estoque" | "ordens" | "orcamentos";

export type AppNotification = {
  id: string;
  tipo: NotificationType;
  severidade: NotificationSeverity;
  titulo: string;
  descricao: string;
  rota: string;
  createdAt: string;
};

export type NotificationsConfig = {
  agenda: { ativo: boolean; diasAntecedencia: number };
  financeiro: { ativo: boolean; diasVencimento: number };
  estoque: { ativo: boolean; limiteBaixo: number };
  ordens: { ativo: boolean; diasParada: number; diasCritico: number };
  orcamentos: { ativo: boolean; diasPendente: number };
};

export const defaultNotificationsConfig: NotificationsConfig = {
  agenda: { ativo: true, diasAntecedencia: 1 },
  financeiro: { ativo: true, diasVencimento: 3 },
  estoque: { ativo: true, limiteBaixo: 3 },
  ordens: { ativo: true, diasParada: 3, diasCritico: 7 },
  orcamentos: { ativo: true, diasPendente: 2 },
};

export async function listarNotificacoes() {
  const { data } = await api.get<AppNotification[]>("/notificacoes");
  return data;
}

export async function buscarConfigNotificacoes() {
  const { data } = await api.get<NotificationsConfig>("/notificacoes/config");
  return data;
}

export async function salvarConfigNotificacoes(config: NotificationsConfig) {
  const { data } = await api.put<NotificationsConfig>("/notificacoes/config", config);
  return data;
}
