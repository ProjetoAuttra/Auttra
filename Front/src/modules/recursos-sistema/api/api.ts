import api from "../../../api/api";

export const systemResourceKeys = ["agenda", "estoque", "fornecedores"] as const;

export type SystemResourceKey = (typeof systemResourceKeys)[number];
export type SystemResourcesMap = Record<SystemResourceKey, boolean>;

export const defaultSystemResources: SystemResourcesMap = {
  agenda: true,
  estoque: true,
  fornecedores: true,
};

export async function obterRecursosSistema() {
  const { data } = await api.get<SystemResourcesMap>("/recursos-sistema");
  return { ...defaultSystemResources, ...data };
}

export async function salvarRecursosSistema(recursos: SystemResourcesMap) {
  const { data } = await api.put<SystemResourcesMap>("/recursos-sistema", recursos);
  return { ...defaultSystemResources, ...data };
}
