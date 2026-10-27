import * as React from 'react';
import {
  Box,
  Stack,
  Typography,
  Divider,
  TextField,
  Button,
  Switch,
  CircularProgress,
  FormControlLabel,
} from '@mui/material';
import ModuleHeader from '../../../components/layout/ModuleHeader';
import { DEFAULT_SETTINGS_SECTION } from '../../../components/layout/SettingsLayout';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import {
  buscarConfigNotificacoes,
  defaultNotificationsConfig,
  salvarConfigNotificacoes,
  type NotificationsConfig,
} from '../../notificacoes/api';
import {
  buscarConfigAgenda,
  buscarConfigFinanceiro,
  defaultAgendaConfig,
  defaultFinanceiroConfig,
  salvarConfigAgenda,
  salvarConfigFinanceiro,
  type AgendaConfig,
  type FinanceiroConfig,
} from '../api/configuracoesOperacionais';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import AccessProfilesManager from './AccessProfilesManager';

type Section = 'perfis' | 'agenda' | 'financeiro' | 'notificacoes';

const validSections: Section[] = ['perfis', 'agenda', 'financeiro', 'notificacoes'];

export default function Configuracoes() {
  const { success, error } = useToast();
  const [searchParams] = useSearchParams();
  const paramSection = searchParams.get('section') as Section | null;
  const openSection: Section = paramSection && validSections.includes(paramSection) ? paramSection : DEFAULT_SETTINGS_SECTION;
  const [editing, setEditing] = React.useState<Section | null>(null);

  const [agenda, setAgenda] = React.useState<AgendaConfig>(defaultAgendaConfig);
  const [loadingAgenda, setLoadingAgenda] = React.useState(false);
  const [loadErrorAgenda, setLoadErrorAgenda] = React.useState(false);
  const [savingAgenda, setSavingAgenda] = React.useState(false);

  const [financeiro, setFinanceiro] = React.useState<FinanceiroConfig>(defaultFinanceiroConfig);
  const [loadingFinanceiro, setLoadingFinanceiro] = React.useState(false);
  const [loadErrorFinanceiro, setLoadErrorFinanceiro] = React.useState(false);
  const [savingFinanceiro, setSavingFinanceiro] = React.useState(false);

  const [notificacoes, setNotificacoes] = React.useState<NotificationsConfig>(defaultNotificationsConfig);
  const [loadingNotificacoes, setLoadingNotificacoes] = React.useState(false);
  const [loadErrorNotificacoes, setLoadErrorNotificacoes] = React.useState(false);
  const [savingNotificacoes, setSavingNotificacoes] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setLoadingAgenda(true);
    setLoadErrorAgenda(false);
    buscarConfigAgenda()
      .then((data) => {
        if (active) setAgenda(data);
      })
      .catch(() => {
        if (active) {
          setLoadErrorAgenda(true);
          error('Não foi possível carregar as configurações de agenda.');
        }
      })
      .finally(() => {
        if (active) setLoadingAgenda(false);
      });
    return () => {
      active = false;
    };
  }, [error]);

  React.useEffect(() => {
    let active = true;
    setLoadingFinanceiro(true);
    setLoadErrorFinanceiro(false);
    buscarConfigFinanceiro()
      .then((data) => {
        if (active) setFinanceiro(data);
      })
      .catch(() => {
        if (active) {
          setLoadErrorFinanceiro(true);
          error('Não foi possível carregar as configurações financeiras.');
        }
      })
      .finally(() => {
        if (active) setLoadingFinanceiro(false);
      });
    return () => {
      active = false;
    };
  }, [error]);

  React.useEffect(() => {
    let active = true;
    setLoadingNotificacoes(true);
    setLoadErrorNotificacoes(false);
    buscarConfigNotificacoes()
      .then((data) => {
        if (active) setNotificacoes(data);
      })
      .catch(() => {
        if (active) {
          setLoadErrorNotificacoes(true);
          error('Não foi possível carregar as configurações de notificações.');
        }
      })
      .finally(() => {
        if (active) setLoadingNotificacoes(false);
      });
    return () => {
      active = false;
    };
  }, [error]);

  React.useEffect(() => {
    setEditing(null);
  }, [openSection]);

  const handleEdit = (section: Section) => setEditing(section);

  const handleCancel = () => setEditing(null);
  const handleSave = async (section?: Section) => {
    if (section === 'agenda') {
      setSavingAgenda(true);
      try {
        const data = await salvarConfigAgenda(agenda);
        setAgenda(data);
        success('Configurações de agenda salvas.');
        setEditing(null);
      } catch {
        error('Não foi possível salvar as configurações de agenda.');
      } finally {
        setSavingAgenda(false);
      }
      return;
    }

    if (section === 'financeiro') {
      setSavingFinanceiro(true);
      try {
        const data = await salvarConfigFinanceiro(financeiro);
        setFinanceiro(data);
        success('Configurações financeiras salvas.');
        setEditing(null);
      } catch {
        error('Não foi possível salvar as configurações financeiras.');
      } finally {
        setSavingFinanceiro(false);
      }
      return;
    }

    if (section !== 'notificacoes') {
      setEditing(null);
      return;
    }

    setSavingNotificacoes(true);
    try {
      const data = await salvarConfigNotificacoes(notificacoes);
      setNotificacoes(data);
      success('Configurações de notificações salvas.');
      setEditing(null);
    } catch {
      error('Não foi possível salvar as configurações de notificações.');
    } finally {
      setSavingNotificacoes(false);
    }
  };

  const loadingBySection: Record<Exclude<Section, 'perfis'>, boolean> = {
    agenda: loadingAgenda,
    financeiro: loadingFinanceiro,
    notificacoes: loadingNotificacoes,
  };
  const loadErrorBySection: Record<Exclude<Section, 'perfis'>, boolean> = {
    agenda: loadErrorAgenda,
    financeiro: loadErrorFinanceiro,
    notificacoes: loadErrorNotificacoes,
  };
  const savingBySection: Record<Exclude<Section, 'perfis'>, boolean> = {
    agenda: savingAgenda,
    financeiro: savingFinanceiro,
    notificacoes: savingNotificacoes,
  };

  const renderSection = (key: Exclude<Section, 'perfis'>, title: string, description: string, icon: React.ReactNode, view: React.ReactNode, form: React.ReactNode) => (
    <SettingsSection
      sectionKey={key}
      title={title}
      description={description}
      icon={icon}
      loading={loadingBySection[key]}
      canEdit={!loadErrorBySection[key]}
      editing={editing === key}
      saving={savingBySection[key]}
      onEdit={() => handleEdit(key)}
      onCancel={handleCancel}
      onSave={() => handleSave(key)}
    >
      {editing === key ? form : view}
    </SettingsSection>
  );

  return (
    <Box>
      {openSection === 'perfis' && (
        <Box data-testid="section-perfis">
          <AccessProfilesManager />
        </Box>
      )}

      {openSection === 'agenda' &&
        renderSection(
          'agenda',
          'Agenda',
          'Horário de funcionamento e duração padrão dos atendimentos.',
          <CalendarMonthRoundedIcon />,
          <DisplayList
            items={[
              ['Horário de funcionamento', `${agenda.horarioInicio} às ${agenda.horarioFim}`],
              ['Dias de atendimento', agenda.dias],
              ['Tempo médio por serviço', agenda.tempoMedio],
            ]}
          />,
          <FieldGrid>
            <TextField label="Horário de início" value={agenda.horarioInicio} onChange={(e) => setAgenda((p) => ({ ...p, horarioInicio: e.target.value }))} />
            <TextField label="Horário de término" value={agenda.horarioFim} onChange={(e) => setAgenda((p) => ({ ...p, horarioFim: e.target.value }))} />
            <TextField label="Dias de atendimento" value={agenda.dias} onChange={(e) => setAgenda((p) => ({ ...p, dias: e.target.value }))} />
            <TextField label="Tempo médio por serviço" value={agenda.tempoMedio} onChange={(e) => setAgenda((p) => ({ ...p, tempoMedio: e.target.value }))} />
          </FieldGrid>
        )}

      {openSection === 'financeiro' &&
        renderSection(
          'financeiro',
          'Financeiro',
          'Formas de pagamento, juros e emissão de recibos.',
          <PaymentsRoundedIcon />,
          <DisplayList
            items={[
              ['Formas de pagamento', financeiro.formasPagamento],
              ['Juros por atraso', financeiro.jurosAtraso],
              ['Emissão automática de recibos', financeiro.emitirRecibos ? 'Ativada' : 'Desativada'],
            ]}
          />,
          <Stack spacing={2.5}>
            <FieldGrid>
              <TextField label="Formas de pagamento" value={financeiro.formasPagamento} onChange={(e) => setFinanceiro((p) => ({ ...p, formasPagamento: e.target.value }))} />
              <TextField label="Juros por atraso" value={financeiro.jurosAtraso} onChange={(e) => setFinanceiro((p) => ({ ...p, jurosAtraso: e.target.value }))} />
            </FieldGrid>
            <FormControlLabel
              control={<Switch checked={financeiro.emitirRecibos} onChange={(e) => setFinanceiro((p) => ({ ...p, emitirRecibos: e.target.checked }))} />}
              label="Emissão automática de recibos"
            />
          </Stack>
        )}

      {openSection === 'notificacoes' &&
        renderSection(
          'notificacoes',
          'Notificações',
          'Defina quando o sistema deve avisar sobre cada área.',
          <NotificationsRoundedIcon />,
          <DisplayList
            items={[
              ['Agenda', notificacoes.agenda.ativo ? `Ativa · ${notificacoes.agenda.diasAntecedencia} dia(s) antes` : 'Inativa'],
              ['Financeiro', notificacoes.financeiro.ativo ? `Ativo · ${notificacoes.financeiro.diasVencimento} dia(s) antes` : 'Inativo'],
              ['Estoque', notificacoes.estoque.ativo ? `Ativo · limite ${notificacoes.estoque.limiteBaixo} un.` : 'Inativo'],
              ['O.S paradas', notificacoes.ordens.ativo ? `Ativa · ${notificacoes.ordens.diasParada}d / crítica ${notificacoes.ordens.diasCritico}d` : 'Inativa'],
              ['Orçamentos', notificacoes.orcamentos.ativo ? `Ativo · ${notificacoes.orcamentos.diasPendente} dia(s) em análise` : 'Inativo'],
            ]}
          />,
          <Stack divider={<Divider flexItem />} spacing={2.5}>
            <NotificationRule
              label="Avisar agendamentos próximos"
              checked={notificacoes.agenda.ativo}
              onToggle={(ativo) => setNotificacoes((p) => ({ ...p, agenda: { ...p.agenda, ativo } }))}
            >
              <NumberField label="Dias de antecedência" value={notificacoes.agenda.diasAntecedencia} onChange={(v) => setNotificacoes((p) => ({ ...p, agenda: { ...p.agenda, diasAntecedencia: v } }))} />
            </NotificationRule>
            <NotificationRule
              label="Avisar pagamentos vencendo ou vencidos"
              checked={notificacoes.financeiro.ativo}
              onToggle={(ativo) => setNotificacoes((p) => ({ ...p, financeiro: { ...p.financeiro, ativo } }))}
            >
              <NumberField label="Dias antes do vencimento" value={notificacoes.financeiro.diasVencimento} onChange={(v) => setNotificacoes((p) => ({ ...p, financeiro: { ...p.financeiro, diasVencimento: v } }))} />
            </NotificationRule>
            <NotificationRule
              label="Avisar estoque baixo"
              checked={notificacoes.estoque.ativo}
              onToggle={(ativo) => setNotificacoes((p) => ({ ...p, estoque: { ...p.estoque, ativo } }))}
            >
              <NumberField label="Quantidade mínima" value={notificacoes.estoque.limiteBaixo} onChange={(v) => setNotificacoes((p) => ({ ...p, estoque: { ...p.estoque, limiteBaixo: v } }))} />
            </NotificationRule>
            <NotificationRule
              label="Avisar O.S paradas"
              checked={notificacoes.ordens.ativo}
              onToggle={(ativo) => setNotificacoes((p) => ({ ...p, ordens: { ...p.ordens, ativo } }))}
            >
              <NumberField label="Dias parada" value={notificacoes.ordens.diasParada} onChange={(v) => setNotificacoes((p) => ({ ...p, ordens: { ...p.ordens, diasParada: v } }))} />
              <NumberField label="Dias crítica" value={notificacoes.ordens.diasCritico} onChange={(v) => setNotificacoes((p) => ({ ...p, ordens: { ...p.ordens, diasCritico: v } }))} />
            </NotificationRule>
            <NotificationRule
              label="Avisar orçamentos pendentes"
              checked={notificacoes.orcamentos.ativo}
              onToggle={(ativo) => setNotificacoes((p) => ({ ...p, orcamentos: { ...p.orcamentos, ativo } }))}
            >
              <NumberField label="Dias em análise" value={notificacoes.orcamentos.diasPendente} onChange={(v) => setNotificacoes((p) => ({ ...p, orcamentos: { ...p.orcamentos, diasPendente: v } }))} />
            </NotificationRule>
          </Stack>
        )}
    </Box>
  );
}


function SettingsSection({
  sectionKey,
  title,
  description,
  icon,
  loading,
  canEdit,
  editing,
  saving,
  onEdit,
  onCancel,
  onSave,
  children,
}: {
  sectionKey: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  loading: boolean;
  canEdit: boolean;
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <Box data-testid={`section-${sectionKey}`}>
      <ModuleHeader
        title={title}
        subtitle={description}
        icon={icon}
        actions={
          !editing && canEdit && !loading ? (
            <Button variant="outlined" startIcon={<EditRoundedIcon />} data-testid={`edit-${sectionKey}`} onClick={onEdit}>
              Editar
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box data-testid={`content-${sectionKey}`} sx={{ mt: 3 }}>{children}</Box>
      )}

      {editing && (
        <Stack direction="row" spacing={1} justifyContent="flex-end" mt={3}>
          <Button variant="outlined" data-testid={`cancel-${sectionKey}`} onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" startIcon={<SaveRoundedIcon />} data-testid={`save-${sectionKey}`} onClick={onSave} disabled={saving}>
            Salvar
          </Button>
        </Stack>
      )}
    </Box>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, maxWidth: 720 }}>{children}</Box>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <TextField label={label} type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />;
}

function NotificationRule({
  label,
  checked,
  onToggle,
  children,
}: {
  label: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '320px 1fr' }, gap: 2, alignItems: 'center' }}>
      <FormControlLabel control={<Switch checked={checked} onChange={(e) => onToggle(e.target.checked)} />} label={label} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, maxWidth: 480 }}>{children}</Box>
    </Box>
  );
}

function DisplayList({ items }: { items: [string, string][] }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 3 }}>
      {items.map(([label, value]) => (
        <Box key={label}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            {label}
          </Typography>
          <Typography>{value || '—'}</Typography>
        </Box>
      ))}
    </Box>
  );
}
