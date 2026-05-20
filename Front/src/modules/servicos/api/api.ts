import api from "../../../api/api";
import { type ServicoForm } from "../dialog";

function mapServico(s: any) {
  return {
    id: s.id,
    nome: s.nome,
    descricao: s.descricao,
    preco: s.preco,
    categoria: s.categoria,
    tempo_estimado: s.tempo_estimado,
    ativo: s.ativo !== false,
    created_at: s.created_at,
  };
}

export async function listarServicos(oficinaId?: number) {
  const res = await api.get("/servicos", {
    params: oficinaId ? { oficina_id: oficinaId } : undefined,
  });
  return res.data.map(mapServico);
}

export async function criarServico(data: ServicoForm, oficinaId: number) {
  const res = await api.post("/servicos", {
    nome: data.nome,
    descricao: data.descricao,
    preco: Number(data.preco),
    categoria: data.categoria,
    tempo_estimado: data.tempo_estimado === "" ? undefined : data.tempo_estimado,
    ativo: data.ativo,
    oficina_id: oficinaId,
  });
  return mapServico(res.data);
}

export async function atualizarServico(id: number, data: ServicoForm) {
  const res = await api.put(`/servicos/${id}`, {
    nome: data.nome,
    descricao: data.descricao,
    preco: Number(data.preco),
    categoria: data.categoria,
    tempo_estimado: data.tempo_estimado === "" ? undefined : data.tempo_estimado,
    ativo: data.ativo,
  });
  return mapServico(res.data);
}

export async function excluirServico(id: number) {
  await api.delete(`/servicos/${id}`);
}
