import type { Location } from 'react-router-dom';
import type { AccessModule } from '../permissions/accessProfiles';
import type { SystemResourceKey } from '../modules/recursos-sistema/api/api';
import { paths } from './paths';

/** Módulos que também dependem de um recurso do sistema ligado na oficina. */
export const moduleResourceMap: Partial<Record<AccessModule, SystemResourceKey>> = {
  agenda: 'agenda',
  estoque: 'estoque',
  fornecedores: 'fornecedores',
};

/** Telas iniciais de cada módulo, na ordem do menu lateral (Configurações por último). */
const rotasNaOrdemDoMenu: Array<{ module: AccessModule; to: string }> = [
  { module: 'painel', to: paths.root },
  { module: 'agenda', to: paths.agenda },
  { module: 'clientes', to: paths.clients },
  { module: 'veiculos', to: paths.veiculos },
  { module: 'orcamentos', to: paths.quotes },
  { module: 'ordens', to: paths.tasks },
  { module: 'financeiro', to: paths.payments },
  { module: 'estoque', to: paths.estoque },
  { module: 'fornecedores', to: paths.fornecedores },
  { module: 'relatorios', to: paths.reports },
  { module: 'configuracoes', to: paths.configuracoes },
  { module: 'funcionarios', to: paths.users },
  { module: 'servicos', to: paths.servicos },
  { module: 'recursos_sistema', to: paths.recursosSistema },
];

/** Primeira tela que o usuário pode abrir, na ordem do menu; null quando não pode abrir nenhuma. */
export function primeiraRotaPermitida(
  can: (module: AccessModule) => boolean,
  isEnabled: (resource: SystemResourceKey) => boolean,
): string | null {
  const rota = rotasNaOrdemDoMenu.find(({ module }) => {
    const resource = moduleResourceMap[module];
    return can(module) && (!resource || isEnabled(resource));
  });
  return rota?.to ?? null;
}

/**
 * Para onde ir depois do login: a tela que o usuário tentou abrir (guardada em `state.from`
 * pelo PrivateRoute) ou o início. Só aceita caminhos internos do sistema.
 */
export function destinoAposLogin(state: unknown): string {
  const from = (state as { from?: Partial<Location> | string } | null)?.from;
  const destino = typeof from === 'string' ? from : from ? `${from.pathname ?? ''}${from.search ?? ''}${from.hash ?? ''}` : '';
  // "//site" e "/\site" o navegador trata como outro domínio.
  const interno = /^\/(?![/\\])/.test(destino);
  if (!interno || destino.startsWith(paths.login)) return paths.root;
  return destino;
}
