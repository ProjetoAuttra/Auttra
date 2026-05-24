import api from "../../../api/api";

export type EmpresaData = {
  id: number;
  nome: string;
  cnpj?: string | null;
  email?: string | null;
  telefone?: string | null;
  logo_url?: string | null;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  cep: string;
  cidade: { id: number; nome: string; uf: string } | null;
};

export async function buscarEmpresa(): Promise<EmpresaData> {
  const { data } = await api.get("/oficinas/minha");
  return data;
}

export async function atualizarEmpresa(payload: {
  nome?: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  logo_url?: string | null;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  cep?: string;
  cidade_nome?: string;
  cidade_uf?: string;
}): Promise<EmpresaData> {
  const { data } = await api.patch("/oficinas/minha", payload);
  return data;
}
