export const accessModules = [
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

export const accessActions = ["read", "create", "update", "delete"] as const;

export type AccessModule = (typeof accessModules)[number];
export type AccessAction = (typeof accessActions)[number];
export type PermissionsMap = Partial<Record<AccessModule, AccessAction[]>>;

export const moduleLabels: Record<AccessModule, string> = {
  painel: "Painel",
  agenda: "Agenda",
  clientes: "Clientes",
  veiculos: "Veículos",
  estoque: "Estoque",
  servicos: "Serviços",
  ordens: "Ordens de serviço",
  financeiro: "Financeiro",
  fornecedores: "Fornecedores",
  orcamentos: "Orçamentos",
  funcionarios: "Funcionários",
  relatorios: "Relatórios",
  configuracoes: "Configurações",
  recursos_sistema: "Recursos do sistema",
};

export const actionLabels: Record<AccessAction, string> = {
  read: "Visualizar",
  create: "Criar",
  update: "Editar",
  delete: "Excluir",
};

/**
 * Chaves de módulo que foram renomeadas. Quem logou antes da troca ainda tem a chave antiga no
 * usuário salvo no navegador (e no token); ela vale como a nova até o próximo login.
 */
const chavesAntigas: Partial<Record<AccessModule, string>> = {
  recursos_sistema: "recursos_adicionais",
};

export function hasPermission(
  permissions: PermissionsMap | undefined,
  module: AccessModule,
  action: AccessAction = "read"
) {
  const antiga = chavesAntigas[module];
  const acoes = permissions?.[module] ?? (antiga ? (permissions as Record<string, AccessAction[]> | undefined)?.[antiga] : undefined);
  return !!acoes?.includes(action);
}
