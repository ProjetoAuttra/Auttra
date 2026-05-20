import { Routes, Route, Navigate } from 'react-router-dom';
import { paths } from '../routes/paths';
import AppLayout from './AppLayout';
import Login from '../modules/autenticacao/pages/Login';
import Home from '../modules/painel/pages/Home';
import Schedule from '../modules/agenda/pages/Schedule';
import Clients from '../modules/clientes/pages/Clientes';
import PendingTasks from '../modules/tarefas/pages/PendingTasks';
import { useAuth } from '../context/AuthContext';
import type { JSX } from 'react';
import Extrato from '../modules/pagamentos/pages/extrato/payments';
import ContasPagar from '../modules/pagamentos/pages/contaspagar/contaspagar';
import ContasReceber from '../modules/pagamentos/pages/contasreceber/contasreceber';
import UserPage from '../modules/usuarios/pages/UserForm';
import ClientDetails from '../modules/clientes/pages/detalhesclientes/detalhesclientes';
import Orcamentos from '../modules/orcamentos/pages/orcamentos';
import Relatorios from '../modules/relatorios/pages/relatorios';
import ClientesRelatorio from '../modules/relatorios/pages/clientes/clientesrelatorio';
import FinanceiroRelatorio from '../modules/relatorios/pages/financeiro/financeirorelatorio';
import AgendaRelatorio from '../modules/relatorios/pages/agenda/agendarelatorio';
import GeralRelatorio from '../modules/relatorios/pages/geral/geralrelatorio';
import Configuracoes from '../modules/configuracoes/pages/configuracoes';
import Veiculos from '../modules/veiculos/pages/veiculos'
import Estoque from '../modules/estoque/pages/estoque';
import ImportarXml from '../modules/estoque/pages/ImportarXml';
import Fornecedores from '../modules/fornecedores/pages/fornecedores';
import Servicos from '../modules/servicos/pages/servicos';
import OrdemServicoDetalhes from '../modules/tarefas/pages/detalhesos/ordemservicodetalhes';
import type { AccessModule } from '../permissions/accessProfiles';
import RecursosAdicionais from '../modules/recursos-adicionais/pages/RecursosAdicionais';
import { useAdditionalResources } from '../context/AdditionalResourcesContext';
import type { AdditionalResourceKey } from '../modules/recursos-adicionais/api/api';

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to={paths.login} replace />;
}

const moduleResourceMap: Partial<Record<AccessModule, AdditionalResourceKey>> = {
  agenda: 'agenda',
  estoque: 'estoque',
  fornecedores: 'fornecedores',
};

function ModuleRoute({ module, children }: { module: AccessModule; children: JSX.Element }) {
  const { can } = useAuth();
  const { isEnabled } = useAdditionalResources();
  const resource = moduleResourceMap[module];
  return can(module) && (!resource || isEnabled(resource)) ? children : <Navigate to={paths.root} replace />;
}

export default function Router() {
  return (
    <Routes>
      <Route path={paths.login} element={<Login />} />
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
        <Route path={paths.users} element={<ModuleRoute module="funcionarios"><UserPage /></ModuleRoute>} />
        <Route path={paths.clientDetails} element={<ModuleRoute module="clientes"><ClientDetails /></ModuleRoute>} />
        <Route path={paths.orcamentos} element={<ModuleRoute module="orcamentos"><Orcamentos /></ModuleRoute>} />
        <Route path={paths.relatorios} element={<ModuleRoute module="relatorios"><Relatorios /></ModuleRoute>} />
        <Route path={paths.clientesRelatorio} element={<ModuleRoute module="relatorios"><ClientesRelatorio /></ModuleRoute>} />
        <Route path={paths.financeiroRelatorio} element={<ModuleRoute module="relatorios"><FinanceiroRelatorio /></ModuleRoute>} />
        <Route path={paths.agendaRelatorio} element={<ModuleRoute module="relatorios"><AgendaRelatorio /></ModuleRoute>} />
        <Route path={paths.geralRelatorio} element={<ModuleRoute module="relatorios"><GeralRelatorio /></ModuleRoute>} />
        <Route path={paths.configuracoes} element={<ModuleRoute module="configuracoes"><Configuracoes /></ModuleRoute>} />
        <Route path={paths.veiculos} element={<ModuleRoute module="veiculos"><Veiculos /></ModuleRoute>} />
        <Route path={paths.estoque} element={<ModuleRoute module="estoque"><Estoque /></ModuleRoute>} />
        <Route path={paths.estoqueImportarXml} element={<ModuleRoute module="estoque"><ImportarXml /></ModuleRoute>} />
        <Route path={paths.fornecedores} element={<ModuleRoute module="fornecedores"><Fornecedores /></ModuleRoute>} />
        <Route path={paths.servicos} element={<ModuleRoute module="servicos"><Servicos /></ModuleRoute>} />
        <Route path={paths.ordemServicoDetalhes} element={<ModuleRoute module="ordens"><OrdemServicoDetalhes /></ModuleRoute>} />
        <Route path={paths.recursosAdicionais} element={<ModuleRoute module="recursos_adicionais"><RecursosAdicionais /></ModuleRoute>} />
      </Route>
    </Routes>
  );
}
