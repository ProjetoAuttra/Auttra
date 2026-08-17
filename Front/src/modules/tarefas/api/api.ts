import api from "../../../api/api";

export async function listarOrdens() {
  const res = await api.get("/ordens");
  return res.data;
}

export async function criarOrdem(data: any) {
  const res = await api.post("/ordens", data);
  return res.data;
}

export async function atualizarOrdem(id: number, data: any) {
  const res = await api.put(`/ordens/${id}`, data);
  return res.data;
}

export async function mudarStatusOrdem(id: number, status: string) {
  const res = await api.put(`/ordens/${id}`, { status });
  return res.data;
}

export async function excluirOrdem(id: number) {
  await api.delete(`/ordens/${id}`);
}

export async function listarClientes() {
  const res = await api.get("/clientes");
  return res.data;
}

export async function listarVeiculos() {
  const res = await api.get("/veiculos");
  return res.data;
}

export async function listarFuncionarios() {
  const res = await api.get("/funcionarios");
  return res.data;
}

export async function listarServicos() {
  const res = await api.get("/servicos");
  return res.data;
}

export async function listarPecas() {
  const res = await api.get("/pecas");
  return res.data;
}
