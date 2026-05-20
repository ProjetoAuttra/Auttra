import api from "../../../../../api/api";

export async function obterVeiculoDetalhes(id: number) {
  const { data } = await api.get(`/veiculos/${id}`);
  return data;
}
