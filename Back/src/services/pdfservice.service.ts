import { renderizarPdf } from "./pdfBrowser.js";
import { Response } from "express";
import { prisma } from "../prisma/client.js";
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
};
