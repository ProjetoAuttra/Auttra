import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { paths } from '../routes/paths';
import AppLayout from './AppLayout';
import Login from '../modules/autenticacao/pages/Login';
import { useAuth } from '../context/AuthContext';
import type { JSX } from 'react';
import SettingsLayout from '../components/layout/SettingsLayout';
import type { AccessModule } from '../permissions/accessProfiles';
import { useAdditionalResources } from '../context/AdditionalResourcesContext';
import CarregandoTela from '../components/common/CarregandoTela';
import { moduleResourceMap, primeiraRotaPermitida } from '../routes/navegacao';

// Cada tela vira um arquivo separado, baixado só quando o usuário entra nela: o Login
// e a primeira tela abrem sem esperar o código do sistema inteiro.
const ResetPassword = lazy(() => import('../modules/autenticacao/pages/ResetPassword'));
const Cadastro = lazy(() => import('../modules/autenticacao/pages/Cadastro'));
const ConfirmarEmail = lazy(() => import('../modules/autenticacao/pages/ConfirmarEmail'));
const PublicTrackingPage = lazy(() => import('../modules/acompanhamento/PublicTrackingPage'));
const Home = lazy(() => import('../modules/painel/pages/Home'));
const Schedule = lazy(() => import('../modules/agenda/pages/Schedule'));
const Clients = lazy(() => import('../modules/clientes/pages/Clientes'));
const PendingTasks = lazy(() => import('../modules/tarefas/pages/PendingTasks'));
const Extrato = lazy(() => import('../modules/pagamentos/pages/extrato/payments'));
const ContasPagar = lazy(() => import('../modules/pagamentos/pages/contaspagar/contaspagar'));
const ContasReceber = lazy(() => import('../modules/pagamentos/pages/contasreceber/contasreceber'));
const UserPage = lazy(() => import('../modules/usuarios/pages/UserForm'));
const ClientDetails = lazy(() => import('../modules/clientes/pages/detalhesclientes/detalhesclientes'));
const Orcamentos = lazy(() => import('../modules/orcamentos/pages/orcamentos'));
const NovoOrcamento = lazy(() => import('../modules/orcamentos/pages/novoorcamento/novoorcamento'));
const OrcamentoDetalhes = lazy(() => import('../modules/orcamentos/pages/detalhesorcamento/detalhesorcamento'));
const Relatorios = lazy(() => import('../modules/relatorios/pages/relatorios'));
const ClientesRelatorio = lazy(() => import('../modules/relatorios/pages/clientes/clientesrelatorio'));
const InadimplenciaRelatorio = lazy(() => import('../modules/relatorios/pages/inadimplencia/inadimplenciarelatorio'));
const ResultadoRelatorio = lazy(() => import('../modules/relatorios/pages/resultado/resultadorelatorio'));
const FaturamentoRelatorio = lazy(() => import('../modules/relatorios/pages/faturamento/faturamentorelatorio'));
const MecanicosRelatorio = lazy(() => import('../modules/relatorios/pages/mecanicos/mecanicosrelatorio'));
const FinanceiroRelatorio = lazy(() => import('../modules/relatorios/pages/financeiro/financeirorelatorio'));
const AgendaRelatorio = lazy(() => import('../modules/relatorios/pages/agenda/agendarelatorio'));
const OrdensParadasRelatorio = lazy(() => import('../modules/relatorios/pages/ordens-paradas/ordensparadasrelatorio'));
const EstoqueCriticoRelatorio = lazy(() => import('../modules/relatorios/pages/estoque-critico/estoquecriticorelatorio'));
const OrcamentosPerdidosRelatorio = lazy(() => import('../modules/relatorios/pages/orcamentos-perdidos/orcamentosperdidosrelatorio'));
const RentabilidadeRelatorio = lazy(() => import('../modules/relatorios/pages/rentabilidade/rentabilidaderelatorio'));
const Configuracoes = lazy(() => import('../modules/configuracoes/pages/configuracoes'));
const Veiculos = lazy(() => import('../modules/veiculos/pages/veiculos'));
const VeiculoDetalhes = lazy(() => import('../modules/veiculos/pages/detalhesveiculos/detalhesveiculos'));
const Estoque = lazy(() => import('../modules/estoque/pages/estoque'));
const ImportarXml = lazy(() => import('../modules/estoque/pages/ImportarXml'));
const Fornecedores = lazy(() => import('../modules/fornecedores/pages/fornecedores'));
const Servicos = lazy(() => import('../modules/servicos/pages/servicos'));
const FormOrdemServico = lazy(() => import('../modules/tarefas/pages/formordem/formordem'));
const OrdemServicoDetalhes = lazy(() => import('../modules/tarefas/pages/detalhesos/ordemservicodetalhes'));
const RecursosAdicionais = lazy(() => import('../modules/recursos-adicionais/pages/RecursosAdicionais'));
const Assinatura = lazy(() => import('../modules/assinatura/pages/Assinatura'));
const SemAcesso = lazy(() => import('../modules/autenticacao/pages/SemAcesso'));
const PaginaNaoEncontrada = lazy(() => import('../modules/autenticacao/pages/PaginaNaoEncontrada'));

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
  const { isEnabled } = useAdditionalResources();
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
        {/* Planos e assinatura: qualquer pessoa da oficina vê (quem paga costuma ser o dono). */}
        <Route path={paths.assinatura} element={<Assinatura />} />
        <Route element={<SettingsLayout />}>
          <Route path={paths.configuracoes} element={<ModuleRoute module="configuracoes"><Configuracoes /></ModuleRoute>} />
          <Route path={paths.users} element={<ModuleRoute module="funcionarios"><UserPage /></ModuleRoute>} />
          <Route path={paths.recursosAdicionais} element={<ModuleRoute module="recursos_adicionais"><RecursosAdicionais /></ModuleRoute>} />
        </Route>
        <Route path="*" element={<PaginaNaoEncontrada />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
