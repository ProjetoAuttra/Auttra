import { renderizarPdf } from "./pdfBrowser.js";
import { Response } from "express";
import { prisma } from "../prisma/client.js";
import { valorPorExtenso } from "../utils/extenso.js";
import { HttpError } from "../utils/httpError.js";
import {
  assinaturas,
  blocoDados,
  cabecalho,
  caixaTexto,
  condicoes,
  dataBr,
  documento,
  formasPagamento,
  tabelaItens,
  destaqueRecibo,
  formaPagamentoRecibo,
  type ItemPdf,
} from "./pdfTemplates.js";

export const renderPdf = renderizarPdf;

const oficinaSelect = {
  nome: true,
  cnpj: true,
  logradouro: true,
  numero: true,
  complemento: true,
  cep: true,
  telefone: true,
  email: true,
  logo_url: true,
  cor_principal: true,
  financeiro_config: true,
  cidade: { select: { nome: true, uf: true } },
} as const;

const STATUS_ORCAMENTO: Record<string, { label: string; classe: string }> = {
  analise: { label: "Em análise", classe: "info" },
  aprovado: { label: "Aprovado", classe: "ok" },
  recusado: { label: "Recusado", classe: "erro" },
};

const STATUS_OS: Record<string, { label: string; classe: string }> = {
  aberta: { label: "Aberta", classe: "info" },
  em_andamento: { label: "Em andamento", classe: "aviso" },
  concluida: { label: "Concluída", classe: "ok" },
  cancelada: { label: "Cancelada", classe: "erro" },
};

const veiculoLinhas = (v?: { placa?: string | null; ano?: number | string | null; cor?: string | null; quilometragem?: number | null } | null) => [
  v?.placa ? `Placa: ${v.placa}` : null,
  v?.ano ? `Ano: ${v.ano}` : null,
  v?.cor ? `Cor: ${v.cor}` : null,
];

const METODO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao: "Cartão",
  boleto: "Boleto",
  transferencia: "Transferência",
};

export const PdfHtmlService = {
  async gerarOrcamentoPDF(id: number, res: Response, oficinaId: number) {
    const orc = await prisma.orcamento.findFirst({
      where: { id, deleted_at: null, cliente: { oficina_id: oficinaId } },
      include: {
        cliente: true,
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
      unitario: i.preco_unitario,
      subtotal: i.subtotal,
    }));

    const veiculoNome = [orc.veiculo?.marca, orc.veiculo?.modelo].filter(Boolean).join(" ");
    const formas = formasPagamento(oficina);

    const corpo = [
      cabecalho(oficina, {
        tipo: "Orçamento",
        numero: orc.id,
        status: STATUS_ORCAMENTO[orc.status] ?? { label: orc.status },
        meta: [`Emitido em ${dataBr(orc.data)}`, ...(orc.validade ? [`Válido até ${dataBr(orc.validade)}`] : [])],
      }),
      `<div class="colunas c2">
        ${blocoDados("Cliente", orc.cliente?.nome ?? "", [orc.cliente?.telefone, orc.cliente?.email, orc.cliente?.cpf ? `CPF/CNPJ: ${orc.cliente.cpf}` : null])}
        ${blocoDados("Veículo", veiculoNome, veiculoLinhas(orc.veiculo))}
      </div>`,
      orc.descricao?.trim() ? caixaTexto("Descrição", orc.descricao) : "",
      tabelaItens(itens, orc.valor, "Serviços e peças"),
      condicoes([
        { rotulo: "Validade da proposta", valor: orc.validade ? `Até ${dataBr(orc.validade)}` : "Consulte a oficina" },
        { rotulo: "Formas de pagamento", valor: formas ?? "A combinar" },
      ]),
      assinaturas(`Aprovação do cliente — ${orc.cliente?.nome ?? ""}`, oficina.nome),
    ].join("");

    const pdfBuffer = await renderPdf(documento(oficina, corpo, `Orçamento Nº ${orc.id}`));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=orcamento_${orc.id}.pdf`);
    res.end(pdfBuffer);
  },

  async gerarOrdemServicoPDF(id: number, res: Response, oficinaId: number) {
    const ordem = await prisma.ordem_servico.findFirst({
      where: { id, deleted_at: null, oficina_id: oficinaId },
      include: {
        cliente: true,
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
      unitario: i.preco_unitario,
      subtotal: i.subtotal,
    }));

    const veiculoNome = [ordem.veiculo?.marca, ordem.veiculo?.modelo].filter(Boolean).join(" ");

    const corpo = [
      cabecalho(ordem.oficina, {
        tipo: "Ordem de serviço",
        numero: ordem.id,
        status: STATUS_OS[ordem.status] ?? { label: ordem.status },
        meta: [
          `Aberta em ${dataBr(ordem.data_abertura, true)}`,
          ...(ordem.data_fechamento ? [`Concluída em ${dataBr(ordem.data_fechamento, true)}`] : []),
        ],
      }),
      `<div class="colunas c3">
        ${blocoDados("Cliente", ordem.cliente?.nome ?? "", [ordem.cliente?.telefone, ordem.cliente?.email])}
        ${blocoDados("Veículo", veiculoNome, veiculoLinhas(ordem.veiculo))}
        ${blocoDados("Responsável", ordem.funcionario?.nome ?? "", [])}
      </div>`,
      tabelaItens(itens, ordem.valor_total, "Serviços e peças"),
      ordem.observacoes?.trim() ? caixaTexto("Observações", ordem.observacoes) : "",
      assinaturas(`Cliente — ${ordem.cliente?.nome ?? ""}`, `Responsável — ${ordem.funcionario?.nome ?? ordem.oficina.nome}`),
    ].join("");

    const pdfBuffer = await renderPdf(documento(ordem.oficina, corpo, `Ordem de serviço Nº ${ordem.id}`));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=ordem_${ordem.id}.pdf`);
    res.end(pdfBuffer);
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
    const linhas = (recebidos.length
      ? recebidos.map((m) => ({ data: m.created_at, metodo: m.metodo ? METODO_LABEL[m.metodo] ?? m.metodo : "—", valor: m.valor }))
      : [{ data: pag.data_pagamento ?? pag.updated_at, metodo: pag.metodo ? METODO_LABEL[pag.metodo] ?? pag.metodo : "—", valor: pag.valor_pago }]);
    const total = recebidos.length ? recebidos.reduce((acc, m) => acc + Number(m.valor), 0) : pag.valor_pago;

    const emissor = usuarioId ? await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { nome: true } }) : null;
    const totalNumero = Number(total);
    const corpo = [
      cabecalho(pag.oficina, {
        tipo: "Recibo",
        numero: pag.id,
        meta: [`Emitido em ${dataBr(new Date(), true)}`],
      }),
      destaqueRecibo(pag.cliente?.nome ?? "", totalNumero, valorPorExtenso(totalNumero)),
      `<div class="secao">${blocoDados("Referente a", pag.descricao?.trim() || "Recebimento", [
        pag.ordem_servico_id ? `Ordem de serviço Nº ${String(pag.ordem_servico_id).padStart(4, "0")}` : null,
        `Vencimento: ${dataBr(pag.data_vencimento)}`,
        pag.cliente?.cpf ? `CPF/CNPJ do cliente: ${pag.cliente.cpf}` : null,
      ])}</div>`,
      formaPagamentoRecibo(linhas),
      assinaturas("Cliente", emissor?.nome ? `${emissor.nome}\n${pag.oficina.nome}` : pag.oficina.nome),
    ].join("");

    const pdfBuffer = await renderPdf(documento(pag.oficina, corpo, `Recibo Nº ${pag.id}`, { rodapeSimples: true }));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=recibo_${pag.id}.pdf`);
    res.end(pdfBuffer);
  },
};
