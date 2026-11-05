import { prisma } from "../prisma/client.js";
import { LIMITE_LISTAGEM } from "../utils/limites.js";
import { canAccess, type PermissionsMap } from "../permissions/accessProfiles.js";
import { formatarQuantidade } from "../utils/quantidade.js";
import { numeroCurto } from "../utils/numeroDocumento.js";

/** Por quanto tempo a resposta do cliente pelo link público aparece nas notificações. */
export const JANELA_RESPOSTA_CLIENTE_MS = 48 * 60 * 60 * 1000;

type NotificationConfig = {
  agenda: { ativo: boolean; diasAntecedencia: number };
  financeiro: { ativo: boolean; diasVencimento: number };
  estoque: { ativo: boolean; limiteBaixo: number };
  ordens: { ativo: boolean; diasParada: number; diasCritico: number };
  orcamentos: { ativo: boolean; diasPendente: number };
};

type AppNotification = {
  id: string;
  tipo: "agenda" | "financeiro" | "estoque" | "ordens" | "orcamentos";
  severidade: "info" | "success" | "warning" | "danger";
  titulo: string;
  descricao: string;
  rota: string;
  createdAt: string;
};

const DAY = 86_400_000;

export const DEFAULT_NOTIFICACOES_CONFIG: NotificationConfig = {
  agenda: { ativo: true, diasAntecedencia: 1 },
  financeiro: { ativo: true, diasVencimento: 3 },
  estoque: { ativo: true, limiteBaixo: 3 },
  ordens: { ativo: true, diasParada: 3, diasCritico: 7 },
  orcamentos: { ativo: true, diasPendente: 2 },
};

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function intAtLeast(value: unknown, fallback: number, min = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.floor(parsed));
}

export function normalizeNotificacoesConfig(value: unknown): NotificationConfig {
  const input = value && typeof value === "object" ? value as any : {};
  const defaults = DEFAULT_NOTIFICACOES_CONFIG;

  return {
    agenda: {
      ativo: bool(input.agenda?.ativo, defaults.agenda.ativo),
      diasAntecedencia: intAtLeast(input.agenda?.diasAntecedencia, defaults.agenda.diasAntecedencia),
    },
    financeiro: {
      ativo: bool(input.financeiro?.ativo, defaults.financeiro.ativo),
      diasVencimento: intAtLeast(input.financeiro?.diasVencimento, defaults.financeiro.diasVencimento),
    },
    estoque: {
      ativo: bool(input.estoque?.ativo, defaults.estoque.ativo),
      limiteBaixo: intAtLeast(input.estoque?.limiteBaixo, defaults.estoque.limiteBaixo),
    },
    ordens: {
      ativo: bool(input.ordens?.ativo, defaults.ordens.ativo),
      diasParada: intAtLeast(input.ordens?.diasParada, defaults.ordens.diasParada),
      diasCritico: intAtLeast(input.ordens?.diasCritico, defaults.ordens.diasCritico),
    },
    orcamentos: {
      ativo: bool(input.orcamentos?.ativo, defaults.orcamentos.ativo),
      diasPendente: intAtLeast(input.orcamentos?.diasPendente, defaults.orcamentos.diasPendente),
    },
  };
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysUntil(date: Date) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - startOfToday().getTime()) / DAY);
}

function daysSince(date: Date) {
  return Math.max(0, -daysUntil(date));
}

function brl(value: unknown) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function getOfficeConfig(oficinaId: number) {
  const oficina = await (prisma.oficina as any).findFirst({
    where: { id: oficinaId, deleted_at: null },
    select: { notificacoes_config: true },
  });
  return normalizeNotificacoesConfig(oficina?.notificacoes_config);
}

export const NotificacoesService = {
  async getConfig(oficinaId: number) {
    return getOfficeConfig(oficinaId);
  },

  async updateConfig(oficinaId: number, data: unknown) {
    const config = normalizeNotificacoesConfig(data);
    await (prisma.oficina as any).update({
      where: { id: oficinaId },
      data: { notificacoes_config: config },
    });
    return config;
  },

  async list(oficinaId: number, permissoes?: PermissionsMap) {
    const config = await getOfficeConfig(oficinaId);
    const today = startOfToday();
    // O menu de notificacoes consulta a cada 60s por aba aberta: as consultas rodam em paralelo,
    // trazem so as colunas usadas e tem teto por categoria (a resposta final mostra no maximo 30).
    const teto = LIMITE_LISTAGEM;

    const financeiro = async (): Promise<AppNotification[]> => {
      if (!config.financeiro.ativo || !canAccess(permissoes, "financeiro", "read")) return [];
      const dueLimit = addDays(today, config.financeiro.diasVencimento + 1);
      const pagamentos = await prisma.pagamento.findMany({
        where: {
          oficina_id: oficinaId,
          deleted_at: null,
          status: { in: ["pendente", "parcial"] },
          data_vencimento: { lt: dueLimit },
        },
        orderBy: { data_vencimento: "asc" },
        take: teto,
        select: {
          id: true,
          tipo: true,
          status: true,
          valor: true,
          descricao: true,
          data_vencimento: true,
          cliente: { select: { nome: true } },
          fornecedor: { select: { nome: true } },
        },
      });

      return pagamentos.map((pagamento) => {
        const diff = daysUntil(pagamento.data_vencimento);
        const isOverdue = diff < 0;
        const isPayable = pagamento.tipo === "pagar";
        const label = isPayable ? "Conta a pagar" : "Conta a receber";
        const person = pagamento.cliente?.nome ?? pagamento.fornecedor?.nome ?? pagamento.descricao ?? "Lancamento financeiro";

        return {
          id: `financeiro-${pagamento.id}-${pagamento.status}-${pagamento.data_vencimento.toISOString()}`,
          tipo: "financeiro",
          severidade: isOverdue ? "danger" : "warning",
          titulo: isOverdue ? `${label} vencida` : diff === 0 ? `${label} vence hoje` : `${label} vence em ${diff}d`,
          descricao: `${person} - ${brl(pagamento.valor)}`,
          rota: isPayable ? "/contas-pagar" : "/contas-receber",
          createdAt: pagamento.data_vencimento.toISOString(),
        };
      });
    };

    const agenda = async (): Promise<AppNotification[]> => {
      if (!config.agenda.ativo || !canAccess(permissoes, "agenda", "read")) return [];
      const end = addDays(today, config.agenda.diasAntecedencia + 1);
      const agendamentos = await prisma.agendamento.findMany({
        where: {
          oficina_id: oficinaId,
          deleted_at: null,
          status: { in: ["pendente", "confirmado"] },
          data_inicio: { gte: today, lt: end },
        },
        orderBy: { data_inicio: "asc" },
        take: teto,
        select: { id: true, titulo: true, status: true, data_inicio: true, cliente: { select: { nome: true } } },
      });

      return agendamentos.map((agendamento) => {
        const diff = daysUntil(agendamento.data_inicio);
        return {
          id: `agenda-${agendamento.id}-${agendamento.status}-${agendamento.data_inicio.toISOString()}`,
          tipo: "agenda",
          severidade: diff === 0 ? "info" : "success",
          titulo: diff === 0 ? "Agendamento hoje" : diff === 1 ? "Agendamento amanha" : `Agendamento em ${diff}d`,
          descricao: `${agendamento.titulo}${agendamento.cliente?.nome ? ` - ${agendamento.cliente.nome}` : ""}`,
          rota: "/agenda",
          createdAt: agendamento.data_inicio.toISOString(),
        };
      });
    };

    const estoque = async (): Promise<AppNotification[]> => {
      if (!config.estoque.ativo || !canAccess(permissoes, "estoque", "read")) return [];
      const pecas = await prisma.peca.findMany({
        where: {
          oficina_id: oficinaId,
          deleted_at: null,
          estoque: { lte: config.estoque.limiteBaixo },
        },
        orderBy: [{ estoque: "asc" }, { updated_at: "desc" }],
        take: teto,
        select: { id: true, nome: true, estoque: true, unidade: true, updated_at: true, created_at: true },
      });

      return pecas.map((peca) => {
        const semEstoque = peca.estoque.lte(0);
        return {
          id: `estoque-${peca.id}-${peca.estoque}`,
          tipo: "estoque",
          severidade: semEstoque ? "danger" : "warning",
          titulo: semEstoque ? "Peca sem estoque" : "Estoque baixo",
          descricao: `${peca.nome} - ${formatarQuantidade(peca.estoque, peca.unidade)}`,
          rota: "/estoque",
          createdAt: (peca.updated_at ?? peca.created_at).toISOString(),
        };
      });
    };

    const ordens = async (): Promise<AppNotification[]> => {
      if (!config.ordens.ativo || !canAccess(permissoes, "ordens", "read")) return [];
      const openedBefore = addDays(today, -config.ordens.diasParada);
      const lista = await prisma.ordem_servico.findMany({
        where: {
          oficina_id: oficinaId,
          deleted_at: null,
          status: { in: ["aberta", "em_andamento"] },
          data_abertura: { lte: openedBefore },
        },
        orderBy: { data_abertura: "asc" },
        take: teto,
        select: { id: true, status: true, data_abertura: true, cliente: { select: { nome: true } } },
      });

      return lista.map((ordem) => {
        const age = daysSince(ordem.data_abertura);
        return {
          id: `ordens-${ordem.id}-${ordem.status}-${age}`,
          tipo: "ordens",
          severidade: age >= config.ordens.diasCritico ? "danger" : "warning",
          titulo: age >= config.ordens.diasCritico ? "O.S parada ha muitos dias" : "O.S aberta ha alguns dias",
          descricao: `#${ordem.id} - ${ordem.cliente?.nome ?? "Cliente nao informado"} - ${age}d`,
          rota: `/ordens/${ordem.id}`,
          createdAt: ordem.data_abertura.toISOString(),
        };
      });
    };

    const orcamentos = async (): Promise<AppNotification[]> => {
      if (!config.orcamentos.ativo || !canAccess(permissoes, "orcamentos", "read")) return [];
      const pendingBefore = addDays(today, -config.orcamentos.diasPendente);
      const lista = await prisma.orcamento.findMany({
        where: {
          oficina_id: oficinaId,
          deleted_at: null,
          status: "analise",
          data: { lte: pendingBefore },
          cliente: { deleted_at: null },
        },
        orderBy: { data: "asc" },
        take: teto,
        select: { id: true, status: true, valor: true, data: true, cliente: { select: { nome: true } } },
      });

      return lista.map((orcamento) => {
        const age = daysSince(orcamento.data);
        return {
          id: `orcamentos-${orcamento.id}-${orcamento.status}-${age}`,
          tipo: "orcamentos",
          severidade: "info",
          titulo: "Orcamento aguardando resposta",
          descricao: `${orcamento.cliente?.nome ?? "Cliente nao informado"} - ${brl(orcamento.valor)}`,
          rota: "/orcamentos",
          createdAt: orcamento.data.toISOString(),
        };
      });
    };

    const respostasClientes = async (): Promise<AppNotification[]> => {
      if (!config.orcamentos.ativo || !canAccess(permissoes, "orcamentos", "read")) return [];
      const lista = await prisma.orcamento.findMany({
        where: {
          oficina_id: oficinaId,
          deleted_at: null,
          respondido_pelo_cliente: true,
          status: { in: ["aprovado", "recusado"] },
          respondido_em: { gte: new Date(Date.now() - JANELA_RESPOSTA_CLIENTE_MS) },
        },
        orderBy: { respondido_em: "desc" },
        take: teto,
        select: { id: true, status: true, valor: true, respondido_em: true, cliente: { select: { nome: true } } },
      });

      return lista.map((orcamento) => {
        const aprovou = orcamento.status === "aprovado";
        const numero = numeroCurto(orcamento.id);
        return {
          id: `orcamento-resposta-${orcamento.id}-${orcamento.status}`,
          tipo: "orcamentos",
          severidade: aprovou ? "success" : "warning",
          titulo: aprovou ? `Cliente aprovou ORC #${numero}` : `Cliente recusou ORC #${numero}`,
          descricao: `${orcamento.cliente?.nome ?? "Cliente nao informado"} - ${brl(orcamento.valor)}`,
          rota: `/orcamentos/${orcamento.id}`,
          createdAt: (orcamento.respondido_em ?? new Date()).toISOString(),
        };
      });
    };

    const notifications = (
      await Promise.all([financeiro(), agenda(), estoque(), ordens(), orcamentos(), respostasClientes()])
    ).flat();

    const severityOrder = { danger: 0, warning: 1, info: 2, success: 3 };
    return notifications
      .sort((a, b) => severityOrder[a.severidade] - severityOrder[b.severidade] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30);
  },
};
