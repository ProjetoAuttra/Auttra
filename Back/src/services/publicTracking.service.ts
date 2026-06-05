import { prisma } from "../prisma/client.js";
import { shortLinks } from "./shortLinks.js";

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
    precoUnitario: toNumber(item.preco_unitario),
    subtotal: toNumber(item.subtotal),
  };
}

function mapOficina(oficina: any) {
  return {
    nome: oficina?.nome ?? "DriveOn",
    telefone: oficina?.telefone ?? null,
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

function buildOrcamentoTimeline(status: string, createdAt: string | null) {
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
      date: null,
    },
  ];
}

export const PublicTrackingService = {
  async getByCode(code: string) {
    const link = shortLinks.get(code);
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
        title: `OS #${String(ordem.id).padStart(3, "0")}`,
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
        where: { id: link.orcamentoId, deleted_at: null, cliente: { oficina_id: link.oficinaId } },
        include: {
          cliente: { include: { oficina: true } },
          veiculo: true,
          itens: { where: { deleted_at: null }, include: { servico: true, peca: true } },
        },
      });
      if (!orcamento) return null;

      const statusInfo = orcamentoStatus[orcamento.status] ?? { label: orcamento.status, tone: "default", progress: 20 };
      const criadoEm = toIso(orcamento.data);
      return {
        type: "orcamento",
        id: orcamento.id,
        code,
        title: `ORC #${String(orcamento.id).padStart(3, "0")}`,
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
        timeline: buildOrcamentoTimeline(orcamento.status, criadoEm),
      };
    }

    return null;
  },
};
