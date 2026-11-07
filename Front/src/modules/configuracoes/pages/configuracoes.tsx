import { Box } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_SETTINGS_SECTION } from '../../../components/layout/SettingsLayout';
import { useAuth } from '../../../context/AuthContext';
import AccessProfilesManager from './AccessProfilesManager';
import SecaoAgenda from '../secoes/SecaoAgenda';
import SecaoFinanceiro from '../secoes/SecaoFinanceiro';
import SecaoDocumentos from '../secoes/SecaoDocumentos';
import SecaoNotificacoes from '../secoes/SecaoNotificacoes';

type Section = 'perfis' | 'agenda' | 'financeiro' | 'documentos' | 'notificacoes';

const validSections: Section[] = ['perfis', 'agenda', 'financeiro', 'documentos', 'notificacoes'];

/**
 * Seções da área de Configurações (o menu fica no SettingsLayout). Cada seção carrega os próprios
 * dados só quando é aberta e salva sozinha; o `key` garante estado novo ao trocar de seção.
 */
export default function Configuracoes() {
  const [searchParams] = useSearchParams();
  const { can } = useAuth();
  const paramSection = searchParams.get('section') as Section | null;
  const section: Section = paramSection && validSections.includes(paramSection) ? paramSection : (DEFAULT_SETTINGS_SECTION as Section);
  const podeEditar = can('configuracoes', 'update');

  if (section === 'perfis') {
    return (
      <Box data-testid="section-perfis">
        <AccessProfilesManager />
      </Box>
    );
  }

  const Secao = { agenda: SecaoAgenda, financeiro: SecaoFinanceiro, documentos: SecaoDocumentos, notificacoes: SecaoNotificacoes }[section];
  return <Secao key={section} podeEditar={podeEditar} />;
}
