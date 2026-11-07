import { Suspense } from 'react';
import { tela } from './telas';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { paths } from '../routes/paths';
import AppLayout from './AppLayout';
import Login from '../modules/autenticacao/pages/Login';
import { useAuth } from '../context/AuthContext';
import type { JSX } from 'react';
import SettingsLayout from '../components/layout/SettingsLayout';
import type { AccessModule } from '../permissions/accessProfiles';
import { useSystemResources } from '../context/SystemResourcesContext';
import CarregandoTela from '../components/common/CarregandoTela';
import { moduleResourceMap, primeiraRotaPermitida } from '../routes/navegacao';

// Cada tela vira um arquivo separado (ver telas.ts), baixado em segundo plano depois que o
// sistema abre.
const ResetPassword = tela(() => import('../modules/autenticacao/pages/ResetPassword'));
const Cadastro = tela(() => import('../modules/autenticacao/pages/Cadastro'));
const ConfirmarEmail = tela(() => import('../modules/autenticacao/pages/ConfirmarEmail'));
const PublicTrackingPage = tela(() => import('../modules/acompanhamento/PublicTrackingPage'));
const Home = tela(() => import('../modules/painel/pages/Home'));
const Schedule = tela(() => import('../modules/agenda/pages/Schedule'));
const Clients = tela(() => import('../modules/clientes/pages/Clientes'));
const PendingTasks = tela(() => import('../modules/tarefas/pages/PendingTasks'));
const Extrato = tela(() => import('../modules/pagamentos/pages/extrato/payments'));
const ContasPagar = tela(() => import('../modules/pagamentos/pages/contaspagar/contaspagar'));
const ContasReceber = tela(() => import('../modules/pagamentos/pages/contasreceber/contasreceber'));
const UserPage = tela(() => import('../modules/usuarios/pages/UserForm'));
const ClientDetails = tela(() => import('../modules/clientes/pages/detalhesclientes/detalhesclientes'));
const Orcamentos = tela(() => import('../modules/orcamentos/pages/orcamentos'));
const NovoOrcamento = tela(() => import('../modules/orcamentos/pages/novoorcamento/novoorcamento'));
const OrcamentoDetalhes = tela(() => import('../modules/orcamentos/pages/detalhesorcamento/detalhesorcamento'));
const Relatorios = tela(() => import('../modules/relatorios/pages/relatorios'));
const ClientesRelatorio = tela(() => import('../modules/relatorios/pages/clientes/clientesrelatorio'));
const InadimplenciaRelatorio = tela(() => import('../modules/relatorios/pages/inadimplencia/inadimplenciarelatorio'));
const ResultadoRelatorio = tela(() => import('../modules/relatorios/pages/resultado/resultadorelatorio'));
const FaturamentoRelatorio = tela(() => import('../modules/relatorios/pages/faturamento/faturamentorelatorio'));
const MecanicosRelatorio = tela(() => import('../modules/relatorios/pages/mecanicos/mecanicosrelatorio'));
const FinanceiroRelatorio = tela(() => import('../modules/relatorios/pages/financeiro/financeirorelatorio'));
const AgendaRelatorio = tela(() => import('../modules/relatorios/pages/agenda/agendarelatorio'));
const OrdensParadasRelatorio = tela(() => import('../modules/relatorios/pages/ordens-paradas/ordensparadasrelatorio'));
const EstoqueCriticoRelatorio = tela(() => import('../modules/relatorios/pages/estoque-critico/estoquecriticorelatorio'));
const OrcamentosPerdidosRelatorio = tela(() => import('../modules/relatorios/pages/orcamentos-perdidos/orcamentosperdidosrelatorio'));
const RentabilidadeRelatorio = tela(() => import('../modules/relatorios/pages/rentabilidade/rentabilidaderelatorio'));
const Configuracoes = tela(() => import('../modules/configuracoes/pages/configuracoes'));
const Veiculos = tela(() => import('../modules/veiculos/pages/veiculos'));
const VeiculoDetalhes = tela(() => import('../modules/veiculos/pages/detalhesveiculos/detalhesveiculos'));
const Estoque = tela(() => import('../modules/estoque/pages/estoque'));
const ImportarXml = tela(() => import('../modules/estoque/pages/ImportarXml'));
const Fornecedores = tela(() => import('../modules/fornecedores/pages/fornecedores'));
const Servicos = tela(() => import('../modules/servicos/pages/servicos'));
const FormOrdemServico = tela(() => import('../modules/tarefas/pages/formordem/formordem'));
const OrdemServicoDetalhes = tela(() => import('../modules/tarefas/pages/detalhesos/ordemservicodetalhes'));
const RecursosSistema = tela(() => import('../modules/recursos-sistema/pages/RecursosSistema'));
const SemAcesso = tela(() => import('../modules/autenticacao/pages/SemAcesso'));
const PaginaNaoEncontrada = tela(() => import('../modules/autenticacao/pages/PaginaNaoEncontrada'));

export function PrivateRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  // Guarda a tela pedida para o login voltar a ela.
  return isAuthenticated ? children : <Navigate to={paths.login} replace state={{ from: location }} />;
}

// Sem permissão para a tela: vai para a primeira que o perfil libera (ordem do menu), em vez de
// mandar sempre para o início, que também pode estar bloqueado e virar loop ou tela em branco.
export function ModuleRoute({ module, children }: { module: AccessModule; children: JSX.Element }) {
  const { can } = useAuth();
  const { isEnabled } = useSystemResources();
  const resource = moduleResourceMap[module];
  if (can(module) && (!resource || isEnabled(resource))) return children;
  const destino = primeiraRotaPermitida(can, isEnabled);
  return destino ? <Navigate to={destino} replace /> : <SemAcesso />;
}

export default function Router() {
  return (
    <Suspense fallback={<CarregandoTela />}>
    <Routes>
      <Route path={paths.login} element={<Login />} />
      <Route path={paths.resetPassword} element={<ResetPassword />} />
      <Route path={paths.cadastro} element={<Cadastro />} />
      <Route path={paths.confirmarEmail} element={<ConfirmarEmail />} />
      <Route path={paths.acompanhamentoPublico} element={<PublicTrackingPage />} />
      <Route
        path={paths.root}
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<ModuleRoute module="painel"><Home /></ModuleRoute>} />
        <Route path={paths.agenda} element={<ModuleRoute module="agenda"><Schedule /></ModuleRoute>} />
        <Route path={paths.clients} element={<ModuleRoute module="clientes"><Clients /></ModuleRoute>} />
        <Route path={paths.tasks} element={<ModuleRoute module="ordens"><PendingTasks /></ModuleRoute>} />
        <Route path={paths.payments} element={<ModuleRoute module="financeiro"><Extrato /></ModuleRoute>} />
        <Route path={paths.contasPagar} element={<ModuleRoute module="financeiro"><ContasPagar /></ModuleRoute>} />
        <Route path={paths.contasReceber} element={<ModuleRoute module="financeiro"><ContasReceber /></ModuleRoute>} />
        <Route path={paths.clientDetails} element={<ModuleRoute module="clientes"><ClientDetails /></ModuleRoute>} />
        <Route path={paths.orcamentos} element={<ModuleRoute module="orcamentos"><Orcamentos /></ModuleRoute>} />
        <Route path={paths.orcamentoNovo} element={<ModuleRoute module="orcamentos"><NovoOrcamento /></ModuleRoute>} />
        <Route path={paths.orcamentoDetails} element={<ModuleRoute module="orcamentos"><OrcamentoDetalhes /></ModuleRoute>} />
        <Route path={paths.relatorios} element={<ModuleRoute module="relatorios"><Relatorios /></ModuleRoute>} />
        <Route path={paths.clientesRelatorio} element={<ModuleRoute module="relatorios"><ClientesRelatorio /></ModuleRoute>} />
        <Route path={paths.fluxoCaixaRelatorio} element={<ModuleRoute module="relatorios"><FinanceiroRelatorio /></ModuleRoute>} />
        <Route path={paths.inadimplenciaRelatorio} element={<ModuleRoute module="relatorios"><InadimplenciaRelatorio /></ModuleRoute>} />
        <Route path={paths.resultadoRelatorio} element={<ModuleRoute module="relatorios"><ResultadoRelatorio /></ModuleRoute>} />
        <Route path={paths.faturamentoRelatorio} element={<ModuleRoute module="relatorios"><FaturamentoRelatorio /></ModuleRoute>} />
        <Route path={paths.mecanicosRelatorio} element={<ModuleRoute module="relatorios"><MecanicosRelatorio /></ModuleRoute>} />
        <Route path={paths.agendaRelatorio} element={<ModuleRoute module="relatorios"><AgendaRelatorio /></ModuleRoute>} />
        <Route path={paths.ordensRelatorio} element={<ModuleRoute module="relatorios"><OrdensParadasRelatorio /></ModuleRoute>} />
        <Route path={paths.estoqueRelatorio} element={<ModuleRoute module="relatorios"><EstoqueCriticoRelatorio /></ModuleRoute>} />
        <Route path={paths.orcamentosRelatorio} element={<ModuleRoute module="relatorios"><OrcamentosPerdidosRelatorio /></ModuleRoute>} />
        <Route path={paths.margemRelatorio} element={<ModuleRoute module="relatorios"><RentabilidadeRelatorio /></ModuleRoute>} />
        <Route path={paths.veiculos} element={<ModuleRoute module="veiculos"><Veiculos /></ModuleRoute>} />
        <Route path={paths.veiculoDetalhes} element={<ModuleRoute module="veiculos"><VeiculoDetalhes /></ModuleRoute>} />
        <Route path={paths.estoque} element={<ModuleRoute module="estoque"><Estoque /></ModuleRoute>} />
        <Route path={paths.estoqueImportarXml} element={<ModuleRoute module="estoque"><ImportarXml /></ModuleRoute>} />
        <Route path={paths.servicos} element={<ModuleRoute module="servicos"><Servicos /></ModuleRoute>} />
        <Route path={paths.fornecedores} element={<ModuleRoute module="fornecedores"><Fornecedores /></ModuleRoute>} />
        <Route path={paths.ordemNova} element={<ModuleRoute module="ordens"><FormOrdemServico /></ModuleRoute>} />
        <Route path={paths.ordemEditar} element={<ModuleRoute module="ordens"><FormOrdemServico /></ModuleRoute>} />
        <Route path={paths.ordemServicoDetalhes} element={<ModuleRoute module="ordens"><OrdemServicoDetalhes /></ModuleRoute>} />
        <Route element={<SettingsLayout />}>
          <Route path={paths.configuracoes} element={<ModuleRoute module="configuracoes"><Configuracoes /></ModuleRoute>} />
          <Route path={paths.users} element={<ModuleRoute module="funcionarios"><UserPage /></ModuleRoute>} />
          <Route path={paths.recursosSistema} element={<ModuleRoute module="recursos_sistema"><RecursosSistema /></ModuleRoute>} />
          {/* Endereço antigo (antes de "Recursos adicionais" virar "Recursos do sistema"): links salvos continuam valendo. */}
          <Route path="/recursos-adicionais" element={<Navigate to={paths.recursosSistema} replace />} />
        </Route>
        <Route path="*" element={<PaginaNaoEncontrada />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
