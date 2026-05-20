import api from "../../../api/api";

export interface ItemPreview {
  codigo: string;
  descricao: string;
  ncm: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total_item: number;
  acao: "vincular" | "nova_peca" | "ignorar";
  peca_id: number | null;
  peca_sugerida: { id: number; nome: string } | null;
}

export interface PreviewNota {
  chave_acesso: string;
  numero_nota: string;
  serie: string;
  data_emissao: string;
  fornecedor_nome: string;
  fornecedor_cnpj: string;
  fornecedor_id: number | null;
  valor_total: number;
  itens: ItemPreview[];
  ja_importada: boolean;
}

export interface ResultadoImportacao {
  itensAtualizados: number;
  itensCriados: number;
  itensIgnorados: number;
}

export async function previewXml(arquivo: File): Promise<PreviewNota> {
  const form = new FormData();
  form.append("arquivo", arquivo);
  const res = await api.post("/importarxml/preview", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function confirmarImportacao(payload: {
  chave_acesso: string;
  numero_nota: string;
  serie: string;
  data_emissao: string;
  fornecedor_id: number | null;
  fornecedor_nome: string;
  valor_total: number;
  itens: Array<{
    descricao: string;
    quantidade: number;
    valor_unitario: number;
    preco_venda: number;
    acao: "vincular" | "nova_peca" | "ignorar";
    peca_id?: number | null;
  }>;
}): Promise<ResultadoImportacao> {
  const res = await api.post("/importarxml/confirmar", payload);
  return res.data;
}
