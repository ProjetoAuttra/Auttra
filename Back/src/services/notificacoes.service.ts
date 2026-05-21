import { prisma } from "../prisma/client.js";
import { canAccess, type PermissionsMap } from "../permissions/accessProfiles.js";

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
    const notifications: AppNotification[] = [];
    const today = startOfToday();

    if (config.financeiro.ativo && canAccess(permissoes, "financeiro", "read")) {
      const dueLimit = addDays(today, config.financeiro.diasVencimento + 1);
      const pagamentos = await prisma.pagamento.findMany({
        where: {
          oficina_id: oficinaId,
          deleted_at: null,
          status: { in: ["pendente", "parcial"] },
          data_vencimento: { lt: dueLimit },
        },
        orderBy: { data_vencimento: "asc" },
        include: {
          cliente: { select: { nome: true } },
          fornecedor: { select: { nome: true } },
        },
      });

      for (const pagamento of pagamentos) {
        const diff = daysUntil(pagamento.data_vencimento);
        const isOverdue = diff < 0;
        const isPayable = pagamento.tipo === "pagar";
        const label = isPayable ? "Conta a pagar" : "Conta a receber";
        const person = pagamento.cliente?.nome ?? pagamento.fornecedor?.nome ?? pagamento.descricao ?? "Lancamento financeiro";

        notifications.push({
          id: `financeiro-${pagamento.id}-${pagamento.status}-${pagamento.data_vencimento.toISOString()}`,
          tipo: "financeiro",
          severidade: isOverdue ? "danger" : "warning",
          titulo: isOverdue ? `${label} vencida` : diff === 0 ? `${label} vence hoje` : `${label} vence em ${diff}d`,
          descricao: `${person} - ${brl(pagamento.valor)}`,
          rota: isPayable ? "/contas-pagar" : "/contas-receber",
          createdAt: pagamento.data_vencimento.toISOString(),
        });
      }
    }

    if (config.agenda.ativo && canAccess(permissoes, "agenda", "read")) {
      const end = addDays(today, config.agenda.diasAntecedencia + 1);
      const agendamentos = await prisma.agendamento.findMany({
        where: {
          oficina_id: oficinaId,
          deleted_at: null,
          status: { in: ["pendente", "confirmado"] },
          data_inicio: { gte: today, lt: end },
        },
        orderBy: { data_inicio: "asc" },
        include: { cliente: { select: { nome: true } } },
      });

      for (const agendamento of agendamentos) {
        const diff = daysUntil(agendamento.data_inicio);
        notifications.push({
          id: `agenda-${agendamento.id}-${agendamento.status}-${agendamento.data_inicio.toISOString()}`,
          tipo: "agenda",
          severidade: diff === 0 ? "info" : "success",
          titulo: diff === 0 ? "Agendamento hoje" : diff === 1 ? "Agendamento amanha" : `Agendamento em ${diff}d`,
          descricao: `${agendamento.titulo}${agendamento.cliente?.nome ? ` - ${agendamento.cliente.nome}` : ""}`,
          rota: "/agenda",
          createdAt: agendamento.data_inicio.toISOString(),
        });
      }
    }

    if (config.estoque.ativo && canAccess(permissoes, "estoque", "read")) {
      const pecas = await prisma.peca.findMany({
        where: {
          oficina_id: oficinaId,
          deleted_at: null,
          estoque: { lte: config.estoque.limiteBaixo },
        },
        orderBy: [{ estoque: "asc" }, { updated_at: "desc" }],
      });

      for (const peca of pecas) {
        notifications.push({
          id: `estoque-${peca.id}-${peca.estoque}`,
          tipo: "estoque",
          severidade: peca.estoque <= 0 ? "danger" : "warning",
          titulo: peca.estoque <= 0 ? "Peca sem estoque" : "Estoque baixo",
          descricao: `${peca.nome} - ${peca.estoque} un.`,
          rota: "/estoque",
          createdAt: (peca.updated_at ?? peca.created_at).toISOString(),
        });
      }
    }

    if (config.ordens.ativo && canAccess(permissoes, "ordens", "read")) {
      const openedBefore = addDays(today, -config.ordens.diasParada);
      const ordens = await prisma.ordem_servico.findMany({
        where: {
          oficina_id: oficinaId,
          deleted_at: null,
          status: { in: ["aberta", "em_andamento"] },
          data_abertura: { lte: openedBefore },
        },
        orderBy: { data_abertura: "asc" },
        include: { cliente: { select: { nome: true } } },
      });

      for (const ordem of ordens) {
        const age = daysSince(ordem.data_abertura);
        notifications.push({
          id: `ordens-${ordem.id}-${ordem.status}-${age}`,
          tipo: "ordens",
          severidade: age >= config.ordens.diasCritico ? "danger" : "warning",
          titulo: age >= config.ordens.diasCritico ? "O.S parada ha muitos dias" : "O.S aberta ha alguns dias",
          descricao: `#${ordem.id} - ${ordem.cliente?.nome ?? "Cliente nao informado"} - ${age}d`,
          rota: `/ordens/${ordem.id}`,
          createdAt: ordem.data_abertura.toISOString(),
        });
      }
    }

    if (config.orcamentos.ativo && canAccess(permissoes, "orcamentos", "read")) {
      const pendingBefore = addDays(today, -config.orcamentos.diasPendente);
      const orcamentos = await prisma.orcamento.findMany({
        where: {
          deleted_at: null,
          status: "analise",
          data: { lte: pendingBefore },
          cliente: { oficina_id: oficinaId, deleted_at: null },
        },
        orderBy: { data: "asc" },
        include: { cliente: { select: { nome: true } } },
      });

      for (const orcamento of orcamentos) {
        const age = daysSince(orcamento.data);
        notifications.push({
          id: `orcamentos-${orcamento.id}-${orcamento.status}-${age}`,
          tipo: "orcamentos",
          severidade: "info",
          titulo: "Orcamento aguardando resposta",
          descricao: `${orcamento.cliente?.nome ?? "Cliente nao informado"} - ${brl(orcamento.valor)}`,
          rota: "/orcamentos",
          createdAt: orcamento.data.toISOString(),
        });
      }
    }

    const severityOrder = { danger: 0, warning: 1, info: 2, success: 3 };
    return notifications
      .sort((a, b) => severityOrder[a.severidade] - severityOrder[b.severidade] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30);
  },
};
