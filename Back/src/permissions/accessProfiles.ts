export const ACCESS_MODULES = [
  "painel",
  "agenda",
  "clientes",
  "veiculos",
  "estoque",
  "servicos",
  "ordens",
  "financeiro",
  "fornecedores",
  "orcamentos",
  "funcionarios",
  "relatorios",
  "configuracoes",
  "recursos_sistema",
] as const;

export const ACCESS_ACTIONS = ["read", "create", "update", "delete"] as const;

export type AccessModule = (typeof ACCESS_MODULES)[number];
export type AccessAction = (typeof ACCESS_ACTIONS)[number];
export type PermissionsMap = Partial<Record<AccessModule, AccessAction[]>>;

export const MODULE_LABELS: Record<AccessModule, string> = {
  painel: "Painel",
  agenda: "Agenda",
  clientes: "Clientes",
  veiculos: "Veiculos",
  estoque: "Estoque",
  servicos: "Servicos",
  ordens: "Ordens de servico",
  financeiro: "Financeiro",
  fornecedores: "Fornecedores",
  orcamentos: "Orcamentos",
  funcionarios: "Funcionarios",
  relatorios: "Relatorios",
  configuracoes: "Configuracoes",
  recursos_sistema: "Recursos do sistema",
};

export const ACTION_LABELS: Record<AccessAction, string> = {
  read: "Visualizar",
  create: "Criar",
  update: "Editar",
  delete: "Excluir",
};

export const DEFAULT_ACCESS_PROFILES: Array<{
  nome: string;
  descricao: string;
  chave: string;
  padrao: boolean;
  permissoes: PermissionsMap;
}> = [
  {
    nome: "Proprietário",
    descricao: "Acesso total a todos os modulos e acoes.",
    chave: "proprietario",
    padrao: true,
    permissoes: Object.fromEntries(
      ACCESS_MODULES.map((module) => [module, [...ACCESS_ACTIONS]])
    ) as PermissionsMap,
  },
  {
    nome: "Mecânico",
    descricao: "Acesso operacional para execucao de servicos e consulta de cadastros.",
    chave: "mecanico",
    padrao: false,
    permissoes: {
      painel: ["read"],
      agenda: ["read", "update"],
      clientes: ["read"],
      veiculos: ["read"],
      estoque: ["read"],
      servicos: ["read"],
      ordens: ["read", "create", "update"],
      orcamentos: ["read", "create", "update"],
    },
  },
  {
    nome: "Recepção",
    descricao: "Acesso para atendimento, agenda, clientes e abertura de ordens.",
    chave: "recepcao",
    padrao: false,
    permissoes: {
      painel: ["read"],
      agenda: [...ACCESS_ACTIONS],
      clientes: ["read", "create", "update"],
      veiculos: ["read", "create", "update"],
      estoque: ["read"],
      servicos: ["read"],
      ordens: ["read", "create", "update"],
      financeiro: ["read", "create", "update"],
      fornecedores: ["read"],
      orcamentos: ["read", "create", "update"],
      funcionarios: ["read"],
      relatorios: ["read"],
    },
  },
];

/**
 * Chaves de módulo que foram renomeadas. Tokens emitidos antes da troca (e qualquer JSON antigo)
 * ainda trazem a chave antiga; ela vale como a nova.
 */
const LEGACY_MODULE_KEYS: Partial<Record<AccessModule, string>> = {
  recursos_sistema: "recursos_adicionais",
};

function actionsFor(input: Record<string, unknown> | undefined, module: AccessModule): unknown {
  const legacy = LEGACY_MODULE_KEYS[module];
  return input?.[module] ?? (legacy ? input?.[legacy] : undefined);
}

export function normalizePermissions(value: unknown): PermissionsMap {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const normalized: PermissionsMap = {};

  for (const module of ACCESS_MODULES) {
    const raw = actionsFor(input, module);
    const actions = Array.isArray(raw) ? raw : [];
    const allowed = actions.filter((action): action is AccessAction =>
      ACCESS_ACTIONS.includes(action as AccessAction)
    );
    if (allowed.length) normalized[module] = Array.from(new Set(allowed));
  }

  return normalized;
}

export function canAccess(
  permissoes: PermissionsMap | undefined,
  module: AccessModule,
  action: AccessAction
) {
  const actions = actionsFor(permissoes as Record<string, unknown> | undefined, module);
  return Array.isArray(actions) && actions.includes(action);
}
