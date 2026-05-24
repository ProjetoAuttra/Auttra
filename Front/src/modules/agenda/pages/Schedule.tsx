import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { Controller, useForm, useWatch } from 'react-hook-form';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';

import api from '../../../api/api';
import ModuleHeader from '../../../components/layout/ModuleHeader';
import { useAuth } from '../../../context/AuthContext';
import { useConfirm } from '../../../context/ConfirmContext';
import { useToast } from '../../../context/ToastContext';
import { AppDialog, AppDialogActions, AppDialogContent } from '../../../components/common/AppDialog';

type HighlightMap = Record<string, number>;
type Appointment = {
  id: number;
  title: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  clientName?: string;
  vehicleLabel?: string;
  ordemServicoId?: number;
  ordemServicoStatus?: string;
};
type FormValues = {
  title: string;
  description?: string;
  start: Dayjs | null;
  end: Dayjs | null;
  location?: string;
  clientId: string;
  vehicleId: string;
  ordemServicoId?: string;
};
type OrdemOption = { id: number; cliente_id: number; status: string; valor_total?: number | string };
type CalendarView = 'month' | 'week' | 'day';
type ClientOption = { id: number; nome: string };
type VehicleOption = { id: number; placa?: string; modelo?: string; marca?: string; cliente_id?: number; clienteId?: number };

const workHours = Array.from({ length: 11 }, (_, index) => index + 8);

const formatTimeRange = (appointment: Appointment) =>
  `${dayjs(appointment.start).format('HH:mm')} - ${dayjs(appointment.end).format('HH:mm')}`;

const groupAppointmentsByStartTime = (items: Appointment[]) => {
  const groups = new Map<string, Appointment[]>();

  items.forEach((appointment) => {
    const key = dayjs(appointment.start).format('HH:mm');
    groups.set(key, [...(groups.get(key) ?? []), appointment]);
  });

  return Array.from(groups.entries())
    .sort(([timeA], [timeB]) => timeA.localeCompare(timeB))
    .map(([time, appointments]) => ({
      time,
      appointments: appointments.sort((a, b) => a.id - b.id),
    }));
};

const normalizeAppointment = (raw: any): Appointment => ({
  id: Number(raw.id),
  title: raw.title ?? raw.titulo ?? 'Agendamento',
  description: raw.description ?? raw.descricao ?? raw.observacao ?? '',
  start: raw.start ?? raw.data_inicio,
  end: raw.end ?? raw.data_fim,
  location: raw.location ?? raw.localizacao ?? '',
  clientName: raw.cliente?.nome,
  vehicleLabel: [raw.veiculo?.marca, raw.veiculo?.modelo, raw.veiculo?.placa].filter(Boolean).join(' '),
  ordemServicoId: raw.ordem_servico_id ?? raw.ordem_servico?.id,
  ordemServicoStatus: raw.ordem_servico?.status,
});

const vehicleLabel = (vehicle: VehicleOption) =>
  [vehicle.marca, vehicle.modelo, vehicle.placa].filter(Boolean).join(' ') || `Veículo #${vehicle.id}`;

const getVehicleClientId = (vehicle: VehicleOption & { cliente?: { id?: number } }) =>
  vehicle.cliente_id ?? vehicle.clienteId ?? vehicle.cliente?.id;

function NewAppointmentDialog({
  open,
  onClose,
  onCreate,
  defaultStart,
  clients,
  vehicles,
  ordens,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: FormValues) => Promise<void>;
  defaultStart?: Dayjs | null;
  clients: ClientOption[];
  vehicles: VehicleOption[];
  ordens: OrdemOption[];
}) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitting },
  } = useForm<FormValues>({
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      start: defaultStart ?? dayjs().hour(9).minute(0).second(0),
      end: (defaultStart ?? dayjs().hour(9).minute(0).second(0)).add(1, 'hour'),
      location: '',
      clientId: '',
      vehicleId: '',
    },
  });
  const start = useWatch({ control, name: 'start' });
  const clientId = useWatch({ control, name: 'clientId' });
  const availableVehicles = useMemo(
    () => vehicles.filter((vehicle) => !clientId || String(getVehicleClientId(vehicle)) === clientId),
    [clientId, vehicles]
  );
  const availableOrdens = useMemo(
    () => ordens.filter((o) => !clientId || String(o.cliente_id) === clientId),
    [clientId, ordens]
  );

  useEffect(() => {
    if (!open) return;
    const base = (defaultStart ?? dayjs().hour(9).minute(0)).second(0);
    reset({ title: '', description: '', start: base, end: base.add(1, 'hour'), location: '', clientId: '', vehicleId: '', ordemServicoId: '' });
  }, [defaultStart, open, reset]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    try {
      await onCreate(data);
      handleClose();
    } catch {
      // A mensagem de erro e exibida pelo fluxo que tentou salvar.
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      onCloseClick={handleClose}
      closeOnBackdrop={false}
      closeOnEscape={false}
      maxWidth="sm"
      title="Novo agendamento"
      icon={<CalendarMonthRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <Stack spacing={2.25} mt={0.5}>
          <Controller
            name="title"
            control={control}
            rules={{ required: 'Informe um título', maxLength: { value: 100, message: 'Máximo de 100 caracteres' } }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Título"
                autoFocus
                error={!!errors.title}
                helperText={errors.title?.message}
                fullWidth
              />
            )}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <Controller
              name="clientId"
              control={control}
              rules={{ required: 'Selecione o cliente' }}
              render={({ field }) => (
                <TextField {...field} select label="Cliente" error={!!errors.clientId} helperText={errors.clientId?.message} fullWidth>
                  {clients.length > 0 ? (
                    clients.map((client) => (
                      <MenuItem key={client.id} value={String(client.id)}>
                        {client.nome}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem value="" disabled>
                      Nenhum cliente encontrado
                    </MenuItem>
                  )}
                </TextField>
              )}
            />
            <Controller
              name="vehicleId"
              control={control}
              rules={{ required: 'Selecione o veículo' }}
              render={({ field }) => (
                <TextField {...field} select label="Veículo" error={!!errors.vehicleId} helperText={errors.vehicleId?.message} fullWidth>
                  {availableVehicles.length > 0 ? (
                    availableVehicles.map((vehicle) => (
                      <MenuItem key={vehicle.id} value={String(vehicle.id)}>
                        {vehicleLabel(vehicle)}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem value="" disabled>
                      {clientId ? 'Nenhum veículo deste cliente' : 'Selecione um cliente primeiro'}
                    </MenuItem>
                  )}
                </TextField>
              )}
            />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <Controller
              name="start"
              control={control}
              rules={{ required: 'Informe o início' }}
              render={({ field }) => (
                <DateTimePicker
                  {...field}
                  label="Início"
                  ampm={false}
                  slotProps={{ textField: { error: !!errors.start, helperText: errors.start?.message, fullWidth: true } }}
                />
              )}
            />
            <Controller
              name="end"
              control={control}
              rules={{
                required: 'Informe o término',
                validate: (value) => (value && start && dayjs(value).isAfter(start) ? true : 'Término deve ser depois do início'),
              }}
              render={({ field }) => (
                <DateTimePicker
                  {...field}
                  label="Término"
                  ampm={false}
                  minDateTime={start ?? undefined}
                  slotProps={{ textField: { error: !!errors.end, helperText: errors.end?.message, fullWidth: true } }}
                />
              )}
            />
          </Box>
          <Controller
            name="location"
            control={control}
            rules={{ maxLength: { value: 120, message: 'Máximo de 120 caracteres' } }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Local"
                error={!!errors.location}
                helperText={errors.location?.message}
                fullWidth
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Observações" multiline rows={3} fullWidth />
            )}
          />
          <Controller
            name="ordemServicoId"
            control={control}
            render={({ field }) => (
              <TextField {...field} select label="Ordem de Serviço (opcional)" fullWidth>
                <MenuItem value="">Nenhuma</MenuItem>
                {availableOrdens.map((o) => (
                  <MenuItem key={o.id} value={String(o.id)}>
                    OS #{o.id} — {o.status}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Stack>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={handleClose} variant="outlined" sx={{ borderRadius: 999 }}>Cancelar</Button>
        <Button onClick={handleSubmit(onSubmit)} variant="contained" disabled={!isValid || isSubmitting} disableElevation sx={{ borderRadius: 999 }}>
          Salvar
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}

function AppointmentCard({
  appointment,
  onDelete,
  onOpen,
}: {
  appointment: Appointment;
  onDelete: (id: number) => void;
  onOpen?: (appointment: Appointment) => void;
}) {
  return (
    <Paper
      elevation={0}
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.(appointment);
      }}
      sx={(theme) => ({
        p: 1.5,
        width: '100%',
        minWidth: 0,
        height: '100%',
        borderRadius: 2.5,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
        bgcolor: alpha(theme.palette.primary.main, 0.07),
        cursor: onOpen ? 'pointer' : 'default',
        '&:hover': onOpen ? { borderColor: alpha(theme.palette.primary.main, 0.34), bgcolor: alpha(theme.palette.primary.main, 0.1) } : undefined,
      })}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box minWidth={0}>
          <Typography fontWeight={800} noWrap>
            {appointment.title}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" mt={0.7} color="text.secondary">
            <AccessTimeRoundedIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" fontWeight={700}>
              {formatTimeRange(appointment)}
            </Typography>
          </Stack>
          {appointment.location && (
            <Stack direction="row" spacing={1} alignItems="center" mt={0.4} color="text.secondary">
              <LocationOnRoundedIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption" noWrap>
                {appointment.location}
              </Typography>
            </Stack>
          )}
          {(appointment.clientName || appointment.vehicleLabel) && (
            <Typography variant="caption" color="text.secondary" display="block" mt={0.6} noWrap>
              {[appointment.clientName, appointment.vehicleLabel].filter(Boolean).join(' • ')}
            </Typography>
          )}
          {appointment.ordemServicoId && (
            <Typography variant="caption" color="primary.main" display="block" mt={0.4} fontWeight={700} noWrap>
              OS #{appointment.ordemServicoId}
            </Typography>
          )}
          {appointment.description && (
            <Typography variant="body2" color="text.secondary" mt={1}>
              {appointment.description}
            </Typography>
          )}
        </Box>
        <IconButton
          onClick={(event) => {
            event.stopPropagation();
            onDelete(appointment.id);
          }}
          sx={{ color: 'text.secondary' }}
        >
          <DeleteOutlineRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Paper>
  );
}

function CompactAppointment({ appointment, onOpen }: { appointment: Appointment; onOpen?: (appointment: Appointment) => void }) {
  return (
    <Box
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.(appointment);
      }}
      sx={(theme) => ({
        px: 1,
        py: 0.6,
        minWidth: 0,
        borderRadius: 1.5,
        bgcolor: alpha(theme.palette.primary.main, 0.09),
        color: 'primary.main',
        overflow: 'hidden',
        cursor: onOpen ? 'pointer' : 'default',
        '&:hover': onOpen ? { bgcolor: alpha(theme.palette.primary.main, 0.14) } : undefined,
      })}
    >
      <Typography sx={{ fontSize: 12, fontWeight: 800 }} noWrap>
        {dayjs(appointment.start).format('HH:mm')} {appointment.title}
      </Typography>
    </Box>
  );
}

function AppointmentDetailsDialog({
  appointment,
  open,
  onClose,
  onSave,
  onDelete,
}: {
  appointment: Appointment | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: number, data: FormValues) => Promise<void>;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitting },
  } = useForm<FormValues>({ mode: 'onChange' });
  const start = useWatch({ control, name: 'start' });

  useEffect(() => {
    if (!appointment) return;
    reset({
      title: appointment.title,
      description: appointment.description ?? '',
      start: dayjs(appointment.start),
      end: dayjs(appointment.end),
      location: appointment.location ?? '',
      clientId: '',
      vehicleId: '',
    });
    setEditing(false);
  }, [appointment, reset]);

  if (!appointment) return null;

  const submit = async (data: FormValues) => {
    await onSave(appointment.id, data);
    setEditing(false);
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      onCloseClick={onClose}
      closeOnBackdrop={!editing}
      closeOnEscape={!editing}
      maxWidth="sm"
      title={editing ? 'Editar agendamento' : 'Resumo do agendamento'}
      icon={<CalendarMonthRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        {editing ? (
          <Stack spacing={2.25} mt={0.5}>
            <Controller
              name="title"
              control={control}
              rules={{ required: 'Informe um título', maxLength: { value: 100, message: 'Máximo de 100 caracteres' } }}
              render={({ field }) => (
                <TextField {...field} label="Título" error={!!errors.title} helperText={errors.title?.message} fullWidth />
              )}
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <Controller
                name="start"
                control={control}
                rules={{ required: 'Informe o início' }}
                render={({ field }) => (
                  <DateTimePicker
                    {...field}
                    label="Início"
                    ampm={false}
                    slotProps={{ textField: { error: !!errors.start, helperText: errors.start?.message, fullWidth: true } }}
                  />
                )}
              />
              <Controller
                name="end"
                control={control}
                rules={{
                  required: 'Informe o término',
                  validate: (value) => (value && start && dayjs(value).isAfter(start) ? true : 'Término deve ser depois do início'),
                }}
                render={({ field }) => (
                  <DateTimePicker
                    {...field}
                    label="Término"
                    ampm={false}
                    minDateTime={start ?? undefined}
                    slotProps={{ textField: { error: !!errors.end, helperText: errors.end?.message, fullWidth: true } }}
                  />
                )}
              />
            </Box>
            <Controller
              name="location"
              control={control}
              render={({ field }) => <TextField {...field} label="Local" fullWidth />}
            />
            <Controller
              name="description"
              control={control}
              render={({ field }) => <TextField {...field} label="Observações" multiline rows={3} fullWidth />}
            />
          </Stack>
        ) : (
          <Stack spacing={2.25}>
            <Box>
              <Typography variant="h6" fontWeight={900}>{appointment.title}</Typography>
              <Typography variant="body2" color="text.secondary">{dayjs(appointment.start).format('dddd, DD [de] MMMM [de] YYYY')}</Typography>
            </Box>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <AccessTimeRoundedIcon color="primary" />
              <Typography fontWeight={800}>{formatTimeRange(appointment)}</Typography>
            </Stack>
            {appointment.location && (
              <Stack direction="row" spacing={1.25} alignItems="center">
                <LocationOnRoundedIcon color="primary" />
                <Typography>{appointment.location}</Typography>
              </Stack>
            )}
            {(appointment.clientName || appointment.vehicleLabel) && (
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#F8FAFC', border: (t) => `1px solid ${t.palette.divider}` }}>
                <Typography variant="caption" color="text.secondary" fontWeight={900}>Cliente e veículo</Typography>
                <Typography fontWeight={800}>{appointment.clientName || 'Cliente não informado'}</Typography>
                <Typography variant="body2" color="text.secondary">{appointment.vehicleLabel || 'Veículo não informado'}</Typography>
              </Paper>
            )}
            {appointment.ordemServicoId && (
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#F8FAFC', border: (t) => `1px solid ${t.palette.divider}` }}>
                <Typography variant="caption" color="text.secondary" fontWeight={900}>Ordem de Serviço vinculada</Typography>
                <Typography fontWeight={800}>OS #{appointment.ordemServicoId}</Typography>
                {appointment.ordemServicoStatus && (
                  <Typography variant="body2" color="text.secondary">{appointment.ordemServicoStatus}</Typography>
                )}
              </Paper>
            )}
            {appointment.description && (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={900}>Observações</Typography>
                <Typography variant="body2">{appointment.description}</Typography>
              </Box>
            )}
          </Stack>
        )}
      </AppDialogContent>
      <AppDialogActions sx={{ justifyContent: 'space-between' }}>
        <Button color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => onDelete(appointment.id)}>
          Excluir
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={editing ? () => setEditing(false) : onClose} variant="outlined" sx={{ borderRadius: 999 }}>{editing ? 'Cancelar' : 'Fechar'}</Button>
          {editing ? (
            <Button variant="contained" onClick={handleSubmit(submit)} disabled={!isValid || isSubmitting} disableElevation sx={{ borderRadius: 999 }}>Salvar</Button>
          ) : (
            <Button variant="contained" startIcon={<EditRoundedIcon />} onClick={() => setEditing(true)} disableElevation sx={{ borderRadius: 999 }}>Editar</Button>
          )}
        </Stack>
      </AppDialogActions>
    </AppDialog>
  );
}

export default function Schedule() {
  const { user } = useAuth();
  const { success, error, warning } = useToast();
  const confirm = useConfirm();

  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [view, setView] = useState<CalendarView>('week');
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<Dayjs | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [ordens, setOrdens] = useState<OrdemOption[]>([]);
  const [loading, setLoading] = useState(true);
  const oficinaId = user?.oficina_id ?? user?.oficinaId;

  useEffect(() => {
    if (!oficinaId) {
      setLoading(false);
      return;
    }

    Promise.allSettled([
      api.get(`/agendamentos/oficina/${oficinaId}`),
      api.get('/clientes'),
      api.get('/veiculos'),
      api.get('/ordens'),
    ])
      .then(([appointmentsResult, clientsResult, vehiclesResult, ordensResult]) => {
        if (appointmentsResult.status === 'fulfilled') {
          const nextAppointments = Array.isArray(appointmentsResult.value.data)
            ? appointmentsResult.value.data.map(normalizeAppointment)
            : [];
          setAppointments(nextAppointments);
        } else {
          console.error('Erro ao carregar agendamentos:', appointmentsResult.reason);
        }

        if (clientsResult.status === 'fulfilled') {
          setClients(Array.isArray(clientsResult.value.data) ? clientsResult.value.data : []);
        } else {
          console.error('Erro ao carregar clientes:', clientsResult.reason);
        }

        if (vehiclesResult.status === 'fulfilled') {
          setVehicles(Array.isArray(vehiclesResult.value.data) ? vehiclesResult.value.data : []);
        } else {
          console.error('Erro ao carregar veículos:', vehiclesResult.reason);
        }

        if (ordensResult.status === 'fulfilled') {
          const raw = Array.isArray(ordensResult.value.data) ? ordensResult.value.data : [];
          setOrdens(raw.map((o: any) => ({ id: o.id, cliente_id: o.cliente_id, status: o.status, valor_total: o.valor_total })));
        } else {
          console.error('Erro ao carregar ordens:', ordensResult.reason);
        }
      })
      .catch((err) => {
        console.error('Erro inesperado ao carregar agenda:', err);
      })
      .finally(() => setLoading(false));
  }, [oficinaId]);

  const filteredAppointments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return appointments;
    return appointments.filter((appointment) =>
      [appointment.title, appointment.description, appointment.location]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }, [appointments, query]);

  const highlights = useMemo<HighlightMap>(() => {
    const map: HighlightMap = {};
    filteredAppointments.forEach((appointment) => {
      const key = dayjs(appointment.start).format('YYYY-MM-DD');
      map[key] = (map[key] ?? 0) + 1;
    });
    return map;
  }, [filteredAppointments]);

  const selectedAppointments = useMemo(
    () =>
      filteredAppointments
        .filter((appointment) => dayjs(appointment.start).isSame(selectedDate, 'day'))
        .sort((a, b) => dayjs(a.start).unix() - dayjs(b.start).unix()),
    [filteredAppointments, selectedDate]
  );

  const weekDays = useMemo(() => {
    const start = selectedDate.startOf('week');
    return Array.from({ length: 7 }, (_, index) => start.add(index, 'day'));
  }, [selectedDate]);

  const monthDays = useMemo(() => {
    const start = selectedDate.startOf('month').startOf('week');
    return Array.from({ length: 42 }, (_, index) => start.add(index, 'day'));
  }, [selectedDate]);

  const todayCount = highlights[dayjs().format('YYYY-MM-DD')] ?? 0;

  const visibleRangeLabel =
    view === 'month'
      ? selectedDate.format('MMMM YYYY')
      : view === 'week'
        ? `${weekDays[0].format('DD MMM')} - ${weekDays[6].format('DD MMM')}`
        : selectedDate.format('DD MMMM, YYYY');

  const goPrevious = () => setSelectedDate((current) => current.subtract(1, view === 'month' ? 'month' : view === 'week' ? 'week' : 'day'));
  const goNext = () => setSelectedDate((current) => current.add(1, view === 'month' ? 'month' : view === 'week' ? 'week' : 'day'));

  const openCreateAt = (date: Dayjs) => {
    const base = date.minute(0).second(0);
    setSelectedDate(base);
    setDraftStart(base);
    setDialogOpen(true);
  };

  const handleCreate = async (data: FormValues) => {
    if (!oficinaId) {
      warning('Usuário sem oficina vinculada.');
      return;
    }

    try {
      const payload = {
        titulo: data.title,
        descricao: data.description || null,
        data_inicio: data.start?.toISOString(),
        data_fim: data.end?.toISOString(),
        localizacao: data.location || null,
        cliente_id: Number(data.clientId),
        veiculo_id: Number(data.vehicleId),
        oficina_id: oficinaId,
        ordem_servico_id: data.ordemServicoId ? Number(data.ordemServicoId) : null,
      };
      const { data: created } = await api.post('/agendamentos', payload);
      const normalized = normalizeAppointment(created);
      setAppointments((current) => [...current, normalized]);
      setSelectedDate(dayjs(normalized.start));
      success('Agendamento criado com sucesso.');
    } catch {
      error('Não foi possível criar o agendamento.');
      throw new Error('create_appointment_failed');
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: 'Excluir agendamento?',
      message: 'Esta ação remove o item da agenda.',
      confirmLabel: 'Sim, excluir',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await api.delete(`/agendamentos/${id}`);
      setAppointments((current) => current.filter((appointment) => appointment.id !== id));
      setSelectedAppointment(null);
      success('Agendamento excluído.');
    } catch {
      error('Não foi possível excluir o agendamento.');
    }
  };

  const handleUpdate = async (id: number, data: FormValues) => {
    try {
      const payload = {
        titulo: data.title,
        descricao: data.description || null,
        data_inicio: data.start?.toISOString(),
        data_fim: data.end?.toISOString(),
        localizacao: data.location || null,
      };
      const { data: updated } = await api.put(`/agendamentos/${id}`, payload);
      const normalized = normalizeAppointment(updated);
      setAppointments((current) => current.map((appointment) => (appointment.id === id ? normalized : appointment)));
      setSelectedAppointment(normalized);
      setSelectedDate(dayjs(normalized.start));
      success('Agendamento atualizado.');
    } catch {
      error('Não foi possível atualizar o agendamento.');
      throw new Error('update_appointment_failed');
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
      <Box sx={{ maxWidth: 1500, mx: 'auto' }}>
        <ModuleHeader
          title="Agenda"
          subtitle={selectedDate.format('dddd, DD [de] MMMM')}
          icon={<CalendarMonthRoundedIcon />}
          metrics={[
            { label: 'Total', value: appointments.length, tone: 'primary' },
            { label: 'Hoje', value: todayCount, tone: 'warning' },
            { label: 'Dia selecionado', value: selectedAppointments.length, tone: 'success' },
          ]}
          searchValue={query}
          searchPlaceholder="Pesquisar por cliente, placa, serviço ou local"
          onSearchChange={setQuery}
          actionLabel="Novo agendamento"
          onAction={() => openCreateAt(selectedDate.hour(9))}
        />

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 3,
            border: (t) => `1px solid ${t.palette.divider}`,
            minHeight: 'calc(100dvh - 250px)',
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" gap={1.5} mb={2}>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <IconButton onClick={goPrevious} sx={{ color: 'text.secondary', bgcolor: 'transparent', '&:hover': { bgcolor: 'transparent', color: 'primary.main' } }}>
                <ArrowBackRoundedIcon />
              </IconButton>
              <Box>
                <Typography variant="h6" fontWeight={900} sx={{ textTransform: 'capitalize' }}>
                  {visibleRangeLabel}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {view === 'month' ? 'Visão mensal' : view === 'week' ? 'Visão semanal' : `${selectedAppointments.length} atendimento(s) no dia`}
                </Typography>
              </Box>
              <IconButton onClick={goNext} sx={{ color: 'text.secondary', bgcolor: 'transparent', '&:hover': { bgcolor: 'transparent', color: 'primary.main' } }}>
                <ArrowForwardRoundedIcon />
              </IconButton>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
              <Button startIcon={<TodayRoundedIcon />} onClick={() => setSelectedDate(dayjs())} sx={{ borderRadius: 999 }}>
                Hoje
              </Button>
              <ToggleButtonGroup
                exclusive
                value={view}
                onChange={(_, nextView) => nextView && setView(nextView)}
                size="small"
                sx={{
                  p: 0.35,
                  borderRadius: 999,
                  bgcolor: '#F1F5F9',
                  '& .MuiToggleButton-root': {
                    px: 2,
                    border: 0,
                    borderRadius: 999,
                    fontWeight: 800,
                    color: 'text.secondary',
                    '&.Mui-selected': { bgcolor: '#fff', color: 'primary.main', boxShadow: '0 8px 20px rgba(16,24,40,0.08)' },
                  },
                }}
              >
                <ToggleButton value="month">Mês</ToggleButton>
                <ToggleButton value="week">Semana</ToggleButton>
                <ToggleButton value="day">Dia</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {loading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 420 }}>
              <CircularProgress />
            </Box>
          ) : view === 'month' ? (
            <Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1, mb: 1 }}>
                {weekDays.map((day) => (
                  <Typography key={day.format('ddd')} variant="caption" color="text.secondary" fontWeight={900} textAlign="center">
                    {day.format('ddd')}
                  </Typography>
                ))}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', gap: 1, overflowX: 'auto' }}>
                {monthDays.map((day) => {
                  const active = day.isSame(selectedDate, 'day');
                  const inMonth = day.isSame(selectedDate, 'month');
                  const dayAppointments = filteredAppointments
                    .filter((appointment) => dayjs(appointment.start).isSame(day, 'day'))
                    .sort((a, b) => dayjs(a.start).unix() - dayjs(b.start).unix());
                  return (
                    <Box
                      key={day.format('YYYY-MM-DD')}
                      onClick={() => openCreateAt(day.hour(9))}
                      sx={(theme) => ({
                        minHeight: 132,
                        p: 1.1,
                        borderRadius: 2,
                        cursor: 'pointer',
                        border: `1px solid ${active ? alpha(theme.palette.primary.main, 0.38) : theme.palette.divider}`,
                        bgcolor: active ? alpha(theme.palette.primary.main, 0.055) : inMonth ? '#fff' : alpha(theme.palette.text.primary, 0.025),
                      })}
                    >
                      <Typography fontWeight={900} color={inMonth ? 'text.primary' : 'text.disabled'}>
                        {day.format('DD')}
                      </Typography>
                      <Stack spacing={0.55} mt={1}>
                        {dayAppointments.slice(0, 3).map((appointment) => (
                          <CompactAppointment key={appointment.id} appointment={appointment} onOpen={setSelectedAppointment} />
                        ))}
                        {dayAppointments.length > 3 && (
                          <Typography variant="caption" color="text.secondary" fontWeight={800}>
                            +{dayAppointments.length - 3} mais
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ) : view === 'week' ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(150px, 1fr))', gap: 1.25, overflowX: 'auto' }}>
              {weekDays.map((day) => {
                const active = day.isSame(selectedDate, 'day');
                const dayAppointments = filteredAppointments
                  .filter((appointment) => dayjs(appointment.start).isSame(day, 'day'))
                  .sort((a, b) => dayjs(a.start).unix() - dayjs(b.start).unix());
                return (
                  <Box
                    key={day.format('YYYY-MM-DD')}
                    onClick={() => openCreateAt(day.hour(9))}
                    sx={(theme) => ({
                      minHeight: 520,
                      p: 1.25,
                      borderRadius: 2.5,
                      border: `1px solid ${active ? alpha(theme.palette.primary.main, 0.42) : theme.palette.divider}`,
                      bgcolor: active ? alpha(theme.palette.primary.main, 0.055) : '#fff',
                    })}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={900}>
                          {day.format('ddd')}
                        </Typography>
                        <Typography fontWeight={950} sx={{ fontSize: 24 }}>
                          {day.format('DD')}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={800}>
                        {dayAppointments.length}
                      </Typography>
                    </Stack>
                    <Stack spacing={1}>
                      {dayAppointments.length > 0 ? (
                        groupAppointmentsByStartTime(dayAppointments).map((group) => (
                          <Box
                            key={group.time}
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: `repeat(${group.appointments.length}, minmax(0, 1fr))`,
                              gap: 0.75,
                            }}
                          >
                            {group.appointments.map((appointment) => (
                              <CompactAppointment key={appointment.id} appointment={appointment} onOpen={setSelectedAppointment} />
                            ))}
                          </Box>
                        ))
                      ) : (
                        <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                          <Typography variant="body2">Livre</Typography>
                        </Box>
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Box sx={{ position: 'relative' }}>
              {workHours.map((hour) => {
                const appointmentGroupsInHour = groupAppointmentsByStartTime(
                  selectedAppointments.filter((appointment) => dayjs(appointment.start).hour() === hour)
                );
                return (
                  <Box
                    key={hour}
                    onClick={() => openCreateAt(selectedDate.hour(hour))}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '56px 1fr', sm: '72px 1fr' },
                      gap: 1.5,
                      minHeight: 78,
                      borderTop: (t) => `1px solid ${t.palette.divider}`,
                      py: 1.25,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.025)' },
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" fontWeight={800}>
                      {String(hour).padStart(2, '0')}:00
                    </Typography>
                    <Stack spacing={1}>
                      {appointmentGroupsInHour.length > 0 ? (
                        appointmentGroupsInHour.map((group) => (
                          <Box
                            key={group.time}
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: `repeat(${group.appointments.length}, minmax(0, 1fr))`,
                              gap: 1,
                            }}
                          >
                            {group.appointments.map((appointment) => (
                              <AppointmentCard key={appointment.id} appointment={appointment} onDelete={handleDelete} onOpen={setSelectedAppointment} />
                            ))}
                          </Box>
                        ))
                      ) : (
                        <Box
                          sx={(theme) => ({
                            height: 42,
                            borderRadius: 2,
                            border: `1px dashed ${alpha(theme.palette.text.primary, 0.12)}`,
                            bgcolor: alpha(theme.palette.common.white, 0.45),
                          })}
                        />
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          )}
        </Paper>
      </Box>

      <NewAppointmentDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setDraftStart(null);
        }}
        onCreate={handleCreate}
        defaultStart={draftStart ?? selectedDate.hour(9).minute(0).second(0)}
        clients={clients}
        vehicles={vehicles}
        ordens={ordens}
      />
      <AppointmentDetailsDialog
        open={!!selectedAppointment}
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onSave={handleUpdate}
        onDelete={handleDelete}
      />
    </LocalizationProvider>
  );
}
