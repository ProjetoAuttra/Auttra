import { prisma } from "../prisma/client.js";
import { hojeISO } from "../utils/datas.js";
import { HttpError } from "../utils/httpError.js";
import { LinksPublicosService } from "./linksPublicos.service.js";
import { numeroCurto } from "../utils/numeroDocumento.js";
import { AssinaturaService } from "./assinatura.service.js";

export const NOME_RESPOSTA_MAX = 120;
export const MOTIVO_RECUSA_MAX = 500;

export type DecisaoCliente = "aprovado" | "recusado";

/** A validade é só-dia (meia-noite UTC): vale até o fim desse dia no fuso da oficina. */
export function orcamentoVencido(validade: Date | null | undefined, hoje = hojeISO()) {
  return !!validade && hoje > validade.toISOString().slice(0, 10);
}

/** Texto opcional do formulário público: aparado, vazio vira null, acima do limite é recusado. */
function textoOpcional(valor: unknown, max: number, campo: string, codigo: string) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "string") throw new HttpError(`${campo} inválido.`, 400, codigo);
  const texto = valor.trim();
  if (texto.length > max) throw new HttpError(`${campo} pode ter no máximo ${max} caracteres.`, 400, codigo);
  return texto || null;
}

const linkInvalido = () => new HttpError("Link expirado ou inválido.", 404, "LINK_INVALIDO");

const toNumber = (value: unknown) => Number(value ?? 0);
const toIso = (value?: Date | string | null) => value ? new Date(value).toISOString() : null;

const ordemStatus: Record<string, { label: string; tone: string; progress: number }> = {
  aberta: { label: "Aguardando aprovação", tone: "warning", progress: 25 },
  em_andamento: { label: "Em andamento", tone: "info", progress: 55 },
  concluida: { label: "Concluída", tone: "success", progress: 100 },
  cancelada: { label: "Cancelada", tone: "error", progress: 100 },
};

const orcamentoStatus: Record<string, { label: string; tone: string; progress: number }> = {
  analise: { label: "Em análise", tone: "warning", progress: 40 },
  aprovado: { label: "Aprovado", tone: "success", progress: 100 },
  recusado: { label: "Recusado", tone: "error", progress: 100 },
};

function mapItem(item: any) {
  const nome = item.nome || item.servico?.nome || item.peca?.nome || (item.tipo_item === "peca" ? "Peça" : "Serviço");
  return {
    id: item.id,
    tipo: item.tipo_item,
    nome,
    quantidade: toNumber(item.quantidade),
    unidade: item.tipo_item === "peca" ? item.peca?.unidade ?? "UN" : null,
    precoUnitario: toNumber(item.preco_unitario),
    subtotal: toNumber(item.subtotal),
  };
}

function mapOficina(oficina: any) {
  return {
    nome: oficina?.nome ?? "DriveOn",
    telefone: oficina?.telefone ?? null,
    whatsapp: oficina?.whatsapp ?? null,
    email: oficina?.email ?? null,
    logoUrl: oficina?.logo_url ?? null,
    endereco: [oficina?.logradouro, oficina?.numero].filter(Boolean).join(", "),
  };
}

function buildOrdemTimeline(status: string, dates: { abertura: string | null; fechamento: string | null }) {
  const order = ["aberta", "em_andamento", "concluida"];
  const currentIndex = status === "cancelada" ? -1 : order.indexOf(status);
  return [
    {
      key: "aberta",
      label: "Recebido pela oficina",
      done: status === "cancelada" || currentIndex >= 0,
      current: status === "aberta",
      date: dates.abertura,
    },
    {
      key: "em_andamento",
      label: "Serviço em andamento",
      done: currentIndex >= 1,
      current: status === "em_andamento",
      date: null,
    },
    {
      key: "concluida",
      label: status === "cancelada" ? "OS cancelada" : "Pronto para retirada",
      done: status === "cancelada" || currentIndex >= 2,
      current: status === "concluida" || status === "cancelada",
      date: dates.fechamento,
    },
  ];
}

function buildOrcamentoTimeline(status: string, createdAt: string | null, respondidoEm: string | null) {
  return [
    {
      key: "criado",
      label: "Orçamento criado",
      done: true,
      current: status === "analise",
      date: createdAt,
    },
    {
      key: "resposta",
      label: status === "recusado" ? "Orçamento recusado" : status === "aprovado" ? "Orçamento aprovado" : "Aguardando resposta",
      done: status !== "analise",
      current: status !== "analise",
      date: status !== "analise" ? respondidoEm : null,
    },
  ];
}

export const PublicTrackingService = {
  async getByCode(code: string) {
    const link = await LinksPublicosService.resolver(code);
    if (!link) return null;

    if (link.osId) {
      if (!link.oficinaId) return null;
      const ordem = await prisma.ordem_servico.findFirst({
        where: { id: link.osId, oficina_id: link.oficinaId, deleted_at: null },
        include: {
          oficina: true,
          cliente: true,
          veiculo: true,
          funcionario: true,
          itens: { where: { deleted_at: null }, include: { servico: true, peca: true } },
        },
      });
      if (!ordem) return null;

      const statusInfo = ordemStatus[ordem.status] ?? { label: ordem.status, tone: "default", progress: 20 };
      const abertura = toIso(ordem.data_abertura);
      const fechamento = toIso(ordem.data_fechamento);
      return {
        type: "ordem",
        id: ordem.id,
        code,
        title: `OS #${numeroCurto(ordem.id)}`,
        status: ordem.status,
        statusLabel: statusInfo.label,
        statusTone: statusInfo.tone,
        progress: statusInfo.progress,
        documentUrl: `/api/s/${code}/pdf`,
        oficina: mapOficina(ordem.oficina),
        cliente: { nome: ordem.cliente?.nome ?? "Cliente" },
        veiculo: {
          marca: ordem.veiculo?.marca ?? "",
          modelo: ordem.veiculo?.modelo ?? "",
          placa: ordem.veiculo?.placa ?? "",
          ano: ordem.veiculo?.ano ?? null,
          cor: ordem.veiculo?.cor ?? null,
          km: ordem.veiculo?.quilometragem ?? null,
        },
        descricao: ordem.observacoes ?? "",
        total: toNumber(ordem.valor_total),
        datas: { abertura, fechamento, validade: null },
        responsavel: ordem.funcionario?.nome ?? null,
        itens: ordem.itens.map(mapItem),
        timeline: buildOrdemTimeline(ordem.status, { abertura, fechamento }),
      };
    }

    if (link.orcamentoId) {
      if (!link.oficinaId) return null;
      const orcamento = await prisma.orcamento.findFirst({
        where: { id: link.orcamentoId, deleted_at: null, oficina_id: link.oficinaId },
        include: {
          cliente: { include: { oficina: true } },
          veiculo: true,
          itens: { where: { deleted_at: null }, include: { servico: true, peca: true } },
        },
      });
      if (!orcamento) return null;

      const statusInfo = orcamentoStatus[orcamento.status] ?? { label: orcamento.status, tone: "default", progress: 20 };
      const criadoEm = toIso(orcamento.data);
      const respondidoEm = toIso(orcamento.respondido_em);
      const vencido = orcamentoVencido(orcamento.validade);
      // Oficina fora do prazo (teste vencido ou suspensa): o cliente vê o orçamento, mas responde direto com ela.
      const respostaPausada =
        orcamento.status === "analise" && !vencido && (await AssinaturaService.somenteLeitura(link.oficinaId));
      return {
        type: "orcamento",
        id: orcamento.id,
        code,
        title: `ORC #${numeroCurto(orcamento.id)}`,
        status: orcamento.status,
        statusLabel: statusInfo.label,
        statusTone: statusInfo.tone,
        progress: statusInfo.progress,
        documentUrl: `/api/s/${code}/pdf`,
        oficina: mapOficina(orcamento.cliente?.oficina),
        cliente: { nome: orcamento.cliente?.nome ?? "Cliente" },
        veiculo: {
          marca: orcamento.veiculo?.marca ?? "",
          modelo: orcamento.veiculo?.modelo ?? "",
          placa: orcamento.veiculo?.placa ?? "",
          ano: orcamento.veiculo?.ano ?? null,
          cor: orcamento.veiculo?.cor ?? null,
          km: orcamento.veiculo?.quilometragem ?? null,
        },
        descricao: orcamento.descricao ?? "",
        total: toNumber(orcamento.valor),
        datas: { abertura: criadoEm, fechamento: null, validade: toIso(orcamento.validade) },
        responsavel: null,
        itens: orcamento.itens.map(mapItem),
        timeline: buildOrcamentoTimeline(orcamento.status, criadoEm, respondidoEm),
        vencido,
        podeResponder: orcamento.status === "analise" && !vencido && !respostaPausada,
        respostaPausada,
        resposta:
          orcamento.respondido_pelo_cliente && orcamento.status !== "analise"
            ? { decisao: orcamento.status, em: respondidoEm, nome: orcamento.respondido_por_nome, motivo: orcamento.motivo_recusa }
            : null,
      };
    }

    return null;
  },

  /**
   * O cliente aprova ou recusa o orçamento pelo link público. Só vale para link de orçamento ativo,
   * orçamento em análise e dentro da validade. A troca de status é atômica: em duas respostas
   * simultâneas, só a primeira passa. Não gera O.S.: a oficina usa o "Gerar O.S." de sempre.
   */
  async responder(code: string, decisao: DecisaoCliente, body: { nome?: unknown; motivo?: unknown }, ip: string | null) {
    const link = await LinksPublicosService.resolver(code);
    if (!link?.orcamentoId || !link.oficinaId) throw linkInvalido();

    const nome = textoOpcional(body?.nome, NOME_RESPOSTA_MAX, "Nome", "NOME_INVALIDO");
    const motivo = decisao === "recusado" ? textoOpcional(body?.motivo, MOTIVO_RECUSA_MAX, "Motivo", "MOTIVO_INVALIDO") : null;

    const where = { id: link.orcamentoId, oficina_id: link.oficinaId, deleted_at: null };
    const orcamento = await prisma.orcamento.findFirst({ where, select: { status: true, validade: true } });
    if (!orcamento) throw linkInvalido();
    if (orcamento.status !== "analise") {
      throw new HttpError("Este orçamento já foi respondido.", 409, "ORCAMENTO_JA_RESPONDIDO");
    }
    if (orcamentoVencido(orcamento.validade)) {
      throw new HttpError("Este orçamento venceu. Fale com a oficina para receber um novo.", 409, "ORCAMENTO_VENCIDO");
    }
    // Oficina fora do prazo (teste vencido ou suspensa) não recebe resposta pelo link.
    if (await AssinaturaService.somenteLeitura(link.oficinaId)) {
      throw new HttpError("Para aprovar ou recusar este orçamento, fale direto com a oficina.", 409, "RESPOSTA_PAUSADA");
    }

    const { count } = await prisma.orcamento.updateMany({
      where: { ...where, status: "analise" },
      data: {
        status: decisao,
        respondido_em: new Date(),
        respondido_por_nome: nome,
        respondido_ip: ip,
        respondido_pelo_cliente: true,
        motivo_recusa: motivo,
      },
    });
    if (count === 0) throw new HttpError("Este orçamento já foi respondido.", 409, "ORCAMENTO_JA_RESPONDIDO");

    return this.getByCode(code);
  },
};
