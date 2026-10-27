import * as React from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import {
  atualizarPerfilAcesso,
  criarPerfilAcesso,
  excluirPerfilAcesso,
  listarPerfisAcesso,
  type PerfilAcesso,
} from '../api/perfisAcesso';
import {
  accessActions,
  accessModules,
  actionLabels,
  moduleLabels,
  type AccessAction,
  type AccessModule,
  type PermissionsMap,
} from '../../../permissions/accessProfiles';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import { AppDialog, AppDialogActions, AppDialogContent } from '../../../components/common/AppDialog';
import ListTableContainer from '../../../components/common/ListTableContainer';
import ModuleHeader from '../../../components/layout/ModuleHeader';

const emptyPermissions = (): PermissionsMap =>
  Object.fromEntries(accessModules.map((module) => [module, []])) as PermissionsMap;

const emptyForm = (): Partial<PerfilAcesso> => ({
  nome: '',
  descricao: '',
  padrao: false,
  permissoes: emptyPermissions(),
});

const countPermissions = (profile: PerfilAcesso) =>
  accessModules.reduce((total, module) => total + (profile.permissoes?.[module]?.length ?? 0), 0);

export default function AccessProfilesManager() {
  const { success, error } = useToast();
  const confirm = useConfirm();
  const [profiles, setProfiles] = React.useState<PerfilAcesso[]>([]);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<Partial<PerfilAcesso>>(emptyForm);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setProfiles(await listarPerfisAcesso());
    } catch {
      error('Não foi possível carregar os perfis de acesso.');
    } finally {
      setLoading(false);
    }
  }, [error]);

  React.useEffect(() => {
    load();
  }, [load]);

  const startNew = () => {
    setSelectedId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const startEdit = (profile: PerfilAcesso) => {
    setSelectedId(profile.id);
    setForm({ ...profile, permissoes: { ...emptyPermissions(), ...profile.permissoes } });
    setDialogOpen(true);
  };

  const has = (module: AccessModule, action: AccessAction) => Boolean(form.permissoes?.[module]?.includes(action));

  const setPermission = (modules: readonly AccessModule[], action: AccessAction, checked: boolean) => {
    setForm((prev) => {
      const permissoes = { ...(prev.permissoes ?? {}) };
      for (const module of modules) {
        const actions = new Set(permissoes[module] ?? []);
        if (checked) actions.add(action);
        else actions.delete(action);
        permissoes[module] = Array.from(actions);
      }
      return { ...prev, permissoes };
    });
  };

  const save = async () => {
    if (!String(form.nome ?? '').trim()) {
      error('Informe o nome do perfil.');
      return;
    }

    setSaving(true);
    try {
      if (selectedId) {
        await atualizarPerfilAcesso(selectedId, form);
        success('Perfil atualizado com sucesso.');
      } else {
        await criarPerfilAcesso(form);
        success('Perfil criado com sucesso.');
      }
      await load();
      setDialogOpen(false);
    } catch (err: any) {
      error(err?.response?.data?.message ?? 'Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selectedId) return;
    const ok = await confirm({
      title: 'Excluir perfil?',
      message: 'Perfis vinculados a usuários ou definidos como padrão não podem ser excluídos.',
      confirmLabel: 'Excluir',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await excluirPerfilAcesso(selectedId);
      success('Perfil excluído com sucesso.');
      setSelectedId(null);
      setDialogOpen(false);
      await load();
    } catch (err: any) {
      error(err?.response?.data?.message ?? 'Não foi possível excluir o perfil.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <ModuleHeader
        title="Perfis de acesso"
        subtitle="Defina quais módulos e ações cada colaborador poderá acessar."
        icon={<SecurityRoundedIcon />}
        actionLabel="Novo perfil"
        onAction={startNew}
      />

      <ListTableContainer sx={{ height: 'auto' }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Perfil</TableCell>
              <TableCell>Descrição</TableCell>
              <TableCell>Permissões</TableCell>
              <TableCell>Usuários</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {profiles.length > 0 ? (
              profiles.map((profile) => (
                <TableRow key={profile.id} hover sx={{ height: 56, cursor: 'pointer' }} onClick={() => startEdit(profile)}>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography fontWeight={600}>{profile.nome}</Typography>
                      {profile.padrao && <Chip label="Padrão" size="small" color="primary" />}
                      {profile.sistema && <Chip label="Sistema" size="small" />}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', maxWidth: 420 }}>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {profile.descricao || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>{countPermissions(profile)}</TableCell>
                  <TableCell>{profile.usuarios_vinculados ?? 0}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Editar perfil">
                      <IconButton
                        aria-label={`Editar ${profile.nome}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          startEdit(profile);
                        }}
                      >
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                  Nenhum perfil cadastrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ListTableContainer>

      <AppDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCloseClick={() => setDialogOpen(false)}
        closeOnBackdrop={false}
        maxWidth="md"
        title={selectedId ? 'Editar perfil' : 'Novo perfil'}
        icon={<SecurityRoundedIcon />}
        variant="entity"
      >
        <AppDialogContent>
          <Stack spacing={2} mb={3}>
            <TextField
              label="Nome"
              value={form.nome ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Descrição"
              value={form.descricao ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(form.padrao)}
                  onChange={(event) => setForm((prev) => ({ ...prev, padrao: event.target.checked }))}
                />
              }
              label="Perfil padrão (apenas um por oficina)"
            />
          </Stack>

          <Typography fontWeight={700} mb={1}>
            Permissões
          </Typography>
          <Box sx={{ maxHeight: '46vh', overflowY: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Módulo</TableCell>
                  {accessActions.map((action) => {
                    const checkedCount = accessModules.filter((module) => has(module, action)).length;
                    return (
                      <TableCell key={action} align="center" padding="checkbox">
                        <Stack direction="row" alignItems="center" justifyContent="center">
                          <Checkbox
                            size="small"
                            checked={checkedCount === accessModules.length}
                            indeterminate={checkedCount > 0 && checkedCount < accessModules.length}
                            onChange={(event) => setPermission(accessModules, action, event.target.checked)}
                            inputProps={{ 'aria-label': `${actionLabels[action]} em todos os módulos` }}
                          />
                          <span>{actionLabels[action]}</span>
                        </Stack>
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {accessModules.map((module) => (
                  <TableRow key={module} hover>
                    <TableCell>{moduleLabels[module]}</TableCell>
                    {accessActions.map((action) => (
                      <TableCell key={action} align="center" padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={has(module, action)}
                          onChange={(event) => setPermission([module], action, event.target.checked)}
                          inputProps={{ 'aria-label': `${actionLabels[action]} ${moduleLabels[module]}` }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </AppDialogContent>

        <AppDialogActions>
          {selectedId && (
            <Button startIcon={<DeleteRoundedIcon />} color="error" onClick={remove}>
              Excluir
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setDialogOpen(false)} variant="outlined">
            Cancelar
          </Button>
          <Button variant="contained" onClick={save} disabled={saving}>
            Salvar
          </Button>
        </AppDialogActions>
      </AppDialog>
    </Box>
  );
}
