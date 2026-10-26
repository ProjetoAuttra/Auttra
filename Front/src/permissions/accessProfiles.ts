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
  "recursos_adicionais",
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
  recursos_adicionais: "Recursos adicionais",
};

export const actionLabels: Record<AccessAction, string> = {
  read: "Visualizar",
  create: "Criar",
  update: "Editar",
  delete: "Excluir",
};

export function hasPermission(
  permissions: PermissionsMap | undefined,
  module: AccessModule,
  action: AccessAction = "read"
) {
  return !!permissions?.[module]?.includes(action);
}
