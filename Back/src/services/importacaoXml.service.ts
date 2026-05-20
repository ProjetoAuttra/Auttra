import xml2js from "xml2js";
import { prisma } from "../prisma/client.js";

function normalizar(str: string): string {
  return str.trim().toLowerCase().replace(/\s+/g, " ");
}

function extrairTexto(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return extrairTexto(val[0]);
  return String(val);
}

function extrairNumero(val: unknown): number {
  const s = extrairTexto(val);
  return parseFloat(s) || 0;
}

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

export interface ItemConfirmar {
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  preco_venda: number;
  acao: "vincular" | "nova_peca" | "ignorar";
  peca_id?: number | null;
}

export interface DadosConfirmar {
  chave_acesso: string;
  numero_nota: string;
  serie: string;
  data_emissao: string;
  fornecedor_id: number | null;
  fornecedor_nome: string;
  valor_total: number;
  itens: ItemConfirmar[];
}

export const ImportacaoXmlService = {
  async parseXml(buffer: Buffer): Promise<Record<string, unknown>> {
    try {
      const resultado = await xml2js.parseStringPromise(buffer.toString("utf-8"), {
        explicitArray: true,
        ignoreAttrs: false,
      });
      return resultado as Record<string, unknown>;
    } catch {
      throw new Error(
        "Não conseguimos ler esse XML. Confira se o arquivo é realmente o XML da nota e tente novamente."
      );
    }
  },

  extrairDadosNota(parsed: Record<string, unknown>) {
    const nfeProc = parsed.nfeProc as Record<string, unknown> | undefined;
    const nfeDireto = parsed.NFe as Record<string, unknown>[] | undefined;

    let infNFe: Record<string, unknown> | null = null;
    let chave = "";

    if (nfeProc) {
      const nfeList = nfeProc.NFe as Record<string, unknown>[] | undefined;
      const nfe = nfeList?.[0];
      infNFe = (nfe?.infNFe as Record<string, unknown>[])?.[0] ?? null;
      const protNFe = nfeProc.protNFe as Record<string, unknown>[] | undefined;
      chave = extrairTexto((protNFe?.[0]?.infProt as Record<string, unknown>[])?.[0]?.chNFe);
    } else if (nfeDireto) {
      infNFe = (nfeDireto[0]?.infNFe as Record<string, unknown>[])?.[0] ?? null;
    }

    if (!infNFe) {
      throw new Error(
        "Não conseguimos ler esse XML. Confira se o arquivo é realmente o XML da nota e tente novamente."
      );
    }

    if (!chave) {
      const attrs = infNFe.$ as Record<string, string> | undefined;
      chave = (attrs?.Id ?? "").replace(/^NFe/, "");
    }

    const ide = (infNFe.ide as Record<string, unknown>[])?.[0] ?? {};
    const emit = (infNFe.emit as Record<string, unknown>[])?.[0] ?? {};
    const totalNFe = (infNFe.total as Record<string, unknown>[])?.[0];
    const icmsTot = (totalNFe?.ICMSTot as Record<string, unknown>[])?.[0] ?? {};
    const detList = (infNFe.det as Record<string, unknown>[]) ?? [];

    const numero = extrairTexto(ide.nNF);
    const serie = extrairTexto(ide.serie);
    const dataEmissao = extrairTexto(ide.dhEmi ?? ide.dEmi);
    const emitenteCnpj = extrairTexto((emit.CNPJ ?? emit.CPF) as unknown);
    const emitenteNome = extrairTexto((emit.xNome ?? emit.xFant) as unknown);
    const valorTotal = extrairNumero(icmsTot.vNF);

    if (!numero && !emitenteCnpj && !valorTotal) {
      throw new Error(
        "O arquivo não parece ser uma nota fiscal válida. Verifique o arquivo e tente novamente."
      );
    }

    return { chave, numero, serie, dataEmissao, emitenteCnpj, emitenteNome, itens: detList, valorTotal };
  },

  async gerarPreview(buffer: Buffer, oficinaId: number): Promise<PreviewNota> {
    const parsed = await this.parseXml(buffer);
    const { chave, numero, serie, dataEmissao, emitenteCnpj, emitenteNome, itens, valorTotal } =
      this.extrairDadosNota(parsed);

    let jaImportada = false;
    if (chave) {
      const existente = await prisma.nota_fiscal_importada.findFirst({
        where: { oficina_id: oficinaId, chave_acesso: chave },
      });
      jaImportada = !!existente;
    }

    let fornecedorId: number | null = null;
    let fornecedorNome = emitenteNome;
    if (emitenteNome) {
      const todos = await prisma.fornecedor.findMany({
        where: { oficina_id: oficinaId, deleted_at: null },
        select: { id: true, nome: true },
      });
      const emitenteNorm = normalizar(emitenteNome);
      const match = todos.find((f: { id: number; nome: string }) => {
        const fNorm = normalizar(f.nome);
        return fNorm === emitenteNorm || emitenteNorm.includes(fNorm) || fNorm.includes(emitenteNorm);
      });
      if (match) {
        fornecedorId = match.id;
        fornecedorNome = match.nome;
      }
    }

    // Busca peças existentes para sugestão de vínculo
    const pecasExistentes = await prisma.peca.findMany({
      where: { oficina_id: oficinaId, deleted_at: null },
      select: { id: true, nome: true },
    });

    const itensMapeados: ItemPreview[] = itens.map((det) => {
      const prod = (det.prod as Record<string, unknown>[])?.[0] ?? {};
      const codigo = extrairTexto(prod.cProd);
      const descricao = extrairTexto(prod.xProd);
      const ncm = extrairTexto(prod.NCM);
      const unidade = extrairTexto((prod.uCom ?? prod.uTrib) as unknown);
      const quantidade = extrairNumero((prod.qCom ?? prod.qTrib) as unknown);
      const valorUnitario = extrairNumero((prod.vUnCom ?? prod.vUnTrib) as unknown);
      const valorTotalItem = extrairNumero(prod.vProd);

      let pecaSugerida: { id: number; nome: string } | null = null;
      const descNorm = normalizar(descricao);
      if (descNorm) {
        const sugestao = pecasExistentes.find((p: { id: number; nome: string }) => {
          const nomeNorm = normalizar(p.nome);
          return nomeNorm === descNorm || descNorm.includes(nomeNorm) || nomeNorm.includes(descNorm);
        });
        if (sugestao) pecaSugerida = sugestao;
      }

      return {
        codigo,
        descricao,
        ncm,
        unidade,
        quantidade,
        valor_unitario: valorUnitario,
        valor_total_item: valorTotalItem,
        acao: pecaSugerida ? "vincular" : "nova_peca",
        peca_id: pecaSugerida?.id ?? null,
        peca_sugerida: pecaSugerida,
      };
    });

    return {
      chave_acesso: chave,
      numero_nota: numero,
      serie,
      data_emissao: dataEmissao,
      fornecedor_nome: fornecedorNome,
      fornecedor_cnpj: emitenteCnpj,
      fornecedor_id: fornecedorId,
      valor_total: valorTotal,
      itens: itensMapeados,
      ja_importada: jaImportada,
    };
  },

  async confirmar(dados: DadosConfirmar, oficinaId: number) {
    if (dados.chave_acesso) {
      const existente = await prisma.nota_fiscal_importada.findFirst({
        where: { oficina_id: oficinaId, chave_acesso: dados.chave_acesso },
      });
      if (existente) {
        throw new Error(
          "Essa nota já foi importada anteriormente. Para evitar duplicidade, o estoque não foi alterado."
        );
      }
    }

    let itensAtualizados = 0;
    let itensCriados = 0;
    let itensIgnorados = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      await tx.nota_fiscal_importada.create({
        data: {
          oficina_id: oficinaId,
          chave_acesso: dados.chave_acesso || `sem-chave-${Date.now()}`,
          numero_nota: dados.numero_nota || null,
          serie: dados.serie || null,
          fornecedor_id: dados.fornecedor_id || null,
          valor_total: dados.valor_total,
          data_emissao: dados.data_emissao ? new Date(dados.data_emissao) : null,
        },
      });

      for (const item of dados.itens) {
        if (item.acao === "ignorar") {
          itensIgnorados++;
          continue;
        }

        if (item.acao === "vincular" && item.peca_id) {
          await tx.peca.update({
            where: { id: item.peca_id },
            data: { estoque: { increment: item.quantidade } },
          });

          if (dados.fornecedor_id) {
            await tx.compra_peca.create({
              data: {
                oficina_id: oficinaId,
                fornecedor_id: dados.fornecedor_id,
                peca_id: item.peca_id,
                quantidade: item.quantidade,
                preco_compra_unitario: item.valor_unitario,
                data_compra: dados.data_emissao ? new Date(dados.data_emissao) : new Date(),
              },
            });
          }
          itensAtualizados++;
        } else if (item.acao === "nova_peca") {
          const novaPeca = await tx.peca.create({
            data: {
              oficina_id: oficinaId,
              nome: item.descricao,
              preco_custo: item.valor_unitario,
              preco_venda: item.preco_venda,
              estoque: item.quantidade,
            },
          });

          if (dados.fornecedor_id) {
            await tx.compra_peca.create({
              data: {
                oficina_id: oficinaId,
                fornecedor_id: dados.fornecedor_id,
                peca_id: novaPeca.id,
                quantidade: item.quantidade,
                preco_compra_unitario: item.valor_unitario,
                data_compra: dados.data_emissao ? new Date(dados.data_emissao) : new Date(),
              },
            });
          }
          itensCriados++;
        }
      }
    });

    return { itensAtualizados, itensCriados, itensIgnorados };
  },
};
