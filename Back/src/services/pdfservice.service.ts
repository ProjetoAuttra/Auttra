import { renderizarPdf } from "./pdfBrowser.js";
import { Response } from "express";
import { prisma } from "../prisma/client.js";
import { valorPorExtenso } from "../utils/extenso.js";
import { HttpError } from "../utils/httpError.js";
import { normalizeDocumentosConfig } from "./configuracoesOperacionais.service.js";
import {
  assinaturas,
  cabecalho,
  caixaTexto,
  dataBr,
  dataHoraBr,
  documento,
  fechamento,
  formasPagamento,
  numeroDoc,
  quadroCliente,
  quadroVeiculo,
  recibo,
  rodape,
  tabelasItens,
  termoGarantia,
  type ItemPdf,
} from "./pdfTemplates.js";

export const renderPdf = renderizarPdf;

const oficinaSelect = {
  nome: true,
  razao_social: true,
  cnpj: true,
  inscricao_estadual: true,
  logradouro: true,
  numero: true,
  complemento: true,
  bairro: true,
  cep: true,
  telefone: true,
  whatsapp: true,
  email: true,
  logo_url: true,
  cor_principal: true,
  financeiro_config: true,
  documentos_config: true,
  cidade: { select: { nome: true, uf: true } },
} as const;

const clienteInclude = { include: { cidade: { select: { nome: true, uf: true } } } } as const;

const STATUS_ORCAMENTO: Record<string, string> = {
  analise: "Em análise",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

const STATUS_OS: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const METODO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao: "Cartão",
  boleto: "Boleto",
  transferencia: "Transferência",
};

/** Garantia e observações configuradas pela oficina, que fecham os termos do orçamento e da OS. */
function termosDaOficina(documentosConfig: unknown) {
  const cfg = normalizeDocumentosConfig(documentosConfig);
  return [termoGarantia(cfg.garantiaDias), cfg.observacoes];
}

function enviarPdf(res: Response, buffer: Buffer, arquivo: string) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=${arquivo}`);
  res.end(buffer);
}

export const PdfHtmlService = {
  async gerarOrcamentoPDF(id: number, res: Response, oficinaId: number) {
    const orc = await prisma.orcamento.findFirst({
      where: { id, deleted_at: null, oficina_id: oficinaId },
      include: {
        cliente: clienteInclude,
        veiculo: true,
        itens: { where: { deleted_at: null }, orderBy: { id: "asc" }, include: { servico: true, peca: true } },
      },
    });
    if (!orc) throw new Error("Orçamento não encontrado.");

    const oficina = await prisma.oficina.findUniqueOrThrow({ where: { id: oficinaId }, select: oficinaSelect });

    const itens: ItemPdf[] = orc.itens.map((i) => ({
      tipo: i.tipo_item === "peca" ? "peca" : "servico",
      nome: i.nome || (i.tipo_item === "peca" ? i.peca?.nome : i.servico?.nome) || "",
      quantidade: i.quantidade,
      unidade: i.tipo_item === "peca" ? i.peca?.unidade : null,
      unitario: i.preco_unitario,
      subtotal: i.subtotal,
    }));

    const validade = orc.validade ? dataBr(orc.validade) : null;

    const corpo = [
      cabecalho(oficina, {
        tipo: "Orçamento",
        numero: orc.id,
        linhas: [
          { rotulo: "Emissão", valor: dataBr(orc.data) },
          ...(validade ? [{ rotulo: "Validade", valor: validade }] : []),
          { rotulo: "Situação", valor: STATUS_ORCAMENTO[orc.status] ?? orc.status },
        ],
      }),
      quadroCliente(orc.cliente),
      quadroVeiculo(orc.veiculo),
      orc.descricao?.trim() ? caixaTexto("Descrição do serviço", orc.descricao) : "",
      tabelasItens(itens),
      fechamento(itens, orc.valor, [
        { rotulo: "Validade da proposta", valor: validade ? `Até ${validade}` : "Consulte a oficina" },
        { rotulo: "Formas de pagamento", valor: formasPagamento(oficina) ?? "A combinar" },
      ]),
      assinaturas(`${orc.cliente?.nome ?? ""}\nCliente: aprovação do orçamento`, `${oficina.nome}\nResponsável`, {
        cidade: oficina.cidade?.nome,
        termos: [
          "Os valores podem mudar se, durante o serviço, forem encontrados outros defeitos. Nesse caso, o cliente será consultado antes de qualquer serviço adicional.",
          "Ao assinar, o cliente autoriza a execução dos serviços e a aplicação das peças descritas neste orçamento.",
          ...termosDaOficina(oficina.documentos_config),
        ],
      }),
    ].join("");

    const buffer = await renderPdf(documento(oficina, corpo), { rodape: rodape(oficina, `Orçamento Nº ${numeroDoc(orc.id)}`) });
    enviarPdf(res, buffer, `orcamento_${orc.id}.pdf`);
  },

  async gerarOrdemServicoPDF(id: number, res: Response, oficinaId: number) {
    const ordem = await prisma.ordem_servico.findFirst({
      where: { id, deleted_at: null, oficina_id: oficinaId },
      include: {
        cliente: clienteInclude,
        veiculo: true,
        funcionario: true,
        oficina: { select: oficinaSelect },
        itens: { where: { deleted_at: null }, orderBy: { id: "asc" }, include: { servico: true, peca: true } },
      },
    });
    if (!ordem) throw new Error("Ordem de serviço não encontrada.");

    const itens: ItemPdf[] = ordem.itens.map((i) => ({
      tipo: i.tipo_item === "peca" ? "peca" : "servico",
      nome: (i.tipo_item === "peca" ? i.peca?.nome : i.servico?.nome) ?? "",
      quantidade: i.quantidade,
      unidade: i.tipo_item === "peca" ? i.peca?.unidade : null,
      unitario: i.preco_unitario,
      subtotal: i.subtotal,
    }));

    const concluida = ordem.status === "concluida";
    const formas = formasPagamento(ordem.oficina);

    const corpo = [
      cabecalho(ordem.oficina, {
        tipo: "Ordem de serviço",
        numero: ordem.id,
        linhas: [
          { rotulo: "Abertura", valor: dataHoraBr(ordem.data_abertura) },
          ...(ordem.data_fechamento ? [{ rotulo: "Conclusão", valor: dataHoraBr(ordem.data_fechamento) }] : []),
          { rotulo: "Situação", valor: STATUS_OS[ordem.status] ?? ordem.status },
        ],
      }),
      quadroCliente(ordem.cliente),
      quadroVeiculo(ordem.veiculo, { rotulo: "Responsável técnico", valor: ordem.funcionario?.nome }),
      tabelasItens(itens),
      fechamento(itens, ordem.valor_total, formas ? [{ rotulo: "Formas de pagamento", valor: formas }] : []),
      ordem.observacoes?.trim() ? caixaTexto("Observações", ordem.observacoes) : "",
      assinaturas(
        `${ordem.cliente?.nome ?? ""}\nCliente`,
        `${ordem.funcionario?.nome ?? ordem.oficina.nome}\nResponsável técnico`,
        {
          cidade: ordem.oficina.cidade?.nome,
          termos: [
            concluida
              ? "Declaro que recebi o veículo com os serviços descritos nesta ordem executados."
              : "Autorizo a execução dos serviços e a aplicação das peças descritas nesta ordem de serviço.",
            ...termosDaOficina(ordem.oficina.documentos_config),
          ],
        }
      ),
    ].join("");

    const buffer = await renderPdf(documento(ordem.oficina, corpo), {
      rodape: rodape(ordem.oficina, `Ordem de serviço Nº ${numeroDoc(ordem.id)}`),
    });
    enviarPdf(res, buffer, `ordem_${ordem.id}.pdf`);
  },

  async gerarReciboPDF(id: number, res: Response, oficinaId: number, usuarioId?: number | null) {
    const pag = await prisma.pagamento.findFirst({
      where: { id, deleted_at: null, oficina_id: oficinaId },
      include: {
        cliente: true,
        oficina: { select: oficinaSelect },
        movimentos: { orderBy: { id: "asc" } },
      },
    });
    if (!pag) throw new HttpError("Recebimento não encontrado.", 404);
    if (pag.tipo !== "receber") throw new HttpError("Só é possível emitir recibo de um recebimento.", 409);
    if (pag.status !== "pago") throw new HttpError("O recibo só pode ser emitido para um recebimento já recebido.", 409);

    // Só entram os pagamentos que continuam valendo (os já estornados ficam de fora).
    const estornados = new Set(pag.movimentos.filter((m) => m.tipo === "estorno" && m.estorno_de_id).map((m) => m.estorno_de_id));
    const recebidos = pag.movimentos.filter((m) => m.tipo === "pagamento" && !estornados.has(m.id));
    const linhas = recebidos.length
      ? recebidos.map((m) => ({ data: m.created_at, metodo: m.metodo ? METODO_LABEL[m.metodo] ?? m.metodo : "—", valor: m.valor }))
      : [{ data: pag.data_pagamento ?? pag.updated_at, metodo: pag.metodo ? METODO_LABEL[pag.metodo] ?? pag.metodo : "—", valor: pag.valor_pago }];
    const total = Number(recebidos.length ? recebidos.reduce((acc, m) => acc + Number(m.valor), 0) : pag.valor_pago);

    const referente = [
      pag.descricao?.trim() || "Recebimento",
      pag.total_parcelas && pag.parcela_numero ? `parcela ${pag.parcela_numero}/${pag.total_parcelas}` : null,
      pag.ordem_servico_id ? `Ordem de serviço Nº ${numeroDoc(pag.ordem_servico_id)}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const emissor = usuarioId ? await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { nome: true } }) : null;

    const corpo = recibo(pag.oficina, {
      numero: pag.id,
      valor: total,
      extenso: valorPorExtenso(total),
      pagador: pag.cliente?.nome ?? "",
      documentoPagador: pag.cliente?.cpf,
      referente,
      recebimentos: linhas,
      data: linhas[linhas.length - 1].data,
      emissor: emissor?.nome,
    });

    const buffer = await renderPdf(documento(pag.oficina, corpo));
    enviarPdf(res, buffer, `recibo_${pag.id}.pdf`);
  },
};
