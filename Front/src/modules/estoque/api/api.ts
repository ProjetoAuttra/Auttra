import api from "../../../api/api";

export async function listarEstoque() {
  const res = await api.get("/pecas");
  return res.data;
}

export async function criarEstoque(data: any, oficinaId: number) {
  const res = await api.post("/pecas", {
    nome: data.nome,
    descricao: data.descricao || null,
    preco_custo: Number(data.preco_custo),
    preco_venda: Number(data.preco_venda),
    estoque: Number(data.estoque),
    oficinaId,
  });
  return res.data;
}

export async function atualizarEstoque(id: number, data: any) {
  const res = await api.put(`/pecas/${id}`, {
    nome: data.nome,
    descricao: data.descricao || null,
    preco_custo: Number(data.preco_custo),
    preco_venda: Number(data.preco_venda),
    estoque: Number(data.estoque),
  });
  return res.data;
}

export async function excluirEstoque(id: number) {
  await api.delete(`/pecas/${id}`);
}

export async function ajustarEstoque(id: number, tipo: "entrada" | "saida", quantidade: number) {
  const res = await api.patch(`/pecas/${id}/ajuste`, { tipo, quantidade });
  return res.data;
}
