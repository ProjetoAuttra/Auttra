import api from "../../../api/api";
import { type VeiculoForm } from "../dialog";

function mapVeiculo(v: any) {
  return {
    id: String(v.id),
    cliente_id: v.cliente_id,
    cliente_nome: v.cliente?.nome || "",
    marca: v.marca,
    modelo: v.modelo,
    ano: v.ano,
    placa: v.placa,
    cor: v.cor,
    combustivel: v.combustivel,
    quilometragem: v.quilometragem,
    observacao: v.observacao,
    criado_em: v.created_at,
  };
}

export async function listarVeiculos(oficinaId?: number) {
  const { data } = await api.get("/veiculos", {
    params: oficinaId ? { oficina_id: oficinaId } : undefined,
  });
  return data.map(mapVeiculo);
}

export async function criarVeiculo(data: VeiculoForm, oficinaId: number) {
  const { data: v } = await api.post("/veiculos", { ...data, oficina_id: oficinaId });
  return mapVeiculo(v);
}

export async function atualizarVeiculo(id: string, data: VeiculoForm) {
  const { data: v } = await api.put(`/veiculos/${id}`, data);
  return mapVeiculo(v);
}

export async function excluirVeiculo(id: string) {
  await api.delete(`/veiculos/${id}`);
}
