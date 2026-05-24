import * as React from 'react';
import { useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Paper, TextField,
  InputAdornment, Button, Chip, Divider, Grid,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { PickersDay, type PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import { Controller, useForm } from 'react-hook-form';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';
import { AppDialog, AppDialogActions, AppDialogContent } from '../../../components/common/AppDialog';

type HighlightMap = Record<string, number>;

type FormValues = {
  title: string;
  description?: string;
  start: Dayjs | null;
  end: Dayjs | null;
  location?: string;
};

function NewAppointmentDialog({
  open,
  onClose,
  onCreate,
  defaultStart,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: FormValues) => void;
  defaultStart?: Dayjs | null;
}) {
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid, isSubmitting },
  } = useForm<FormValues>({
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      start: defaultStart ?? dayjs().minute(0).second(0),
      end: (defaultStart ?? dayjs()).minute(0).second(0).add(1, 'hour'),
      location: '',
    },
  });

  React.useEffect(() => {
    if (open && defaultStart) {
      setValue('start', defaultStart.minute(0).second(0));
      setValue('end', defaultStart.minute(0).second(0).add(1, 'hour'));
    }
  }, [open, defaultStart, setValue]);

  const start = watch('start');

  const onSubmit = (data: FormValues) => {
    onCreate(data);
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      title="Novo agendamento"
      icon={<EventNoteRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <Stack spacing={1.5}>
          <Controller
            name="title"
            control={control}
            rules={{
              required: 'Informe um título',
              maxLength: { value: 80, message: 'Máximo de 80 caracteres' },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Título *"
                placeholder="Ex.: Troca de vela - Gustavo"
                size="small"
                autoFocus
                error={!!errors.title}
                helperText={errors.title?.message}
                fullWidth
              />
            )}
          />

          <Controller
            name="description"
            control={control}
            rules={{ maxLength: { value: 500, message: 'Máximo de 500 caracteres' } }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Descrição"
                placeholder="Anotações, observações, etc..."
                size="small"
                multiline
                rows={2}
                error={!!errors.description}
                helperText={errors.description?.message}
                fullWidth
              />
            )}
          />

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="start"
                control={control}
                rules={{ required: 'Informe a data/hora de início' }}
                render={({ field }) => (
                  <DateTimePicker
                    {...field}
                    label="Início"
                    ampm={false}
                    slotProps={{
                      textField: {
                        size: 'small',
                        error: !!errors.start,
                        helperText: errors.start?.message,
                        fullWidth: true,
                      },
                      popper: { placement: 'bottom-start' },
                    }}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="end"
                control={control}
                rules={{
                  required: 'Informe a data/hora de término',
                  validate: (value) =>
                    value && start && dayjs(value).isAfter(start)
                      ? true
                      : 'Término deve ser depois do início',
                }}
                render={({ field }) => (
                  <DateTimePicker
                    {...field}
                    label="Término"
                    ampm={false}
                    minDateTime={start ?? undefined}
                    slotProps={{
                      textField: {
                        size: 'small',
                        error: !!errors.end,
                        helperText: errors.end?.message,
                        fullWidth: true,
                      },
                      popper: { placement: 'bottom-start' },
                    }}
                  />
                )}
              />
            </Grid>
          </Grid>

          <Controller
            name="location"
            control={control}
            rules={{ maxLength: { value: 120, message: 'Máximo de 120 caracteres' } }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Local (opcional)"
                size="small"
                placeholder="Sala 2, Estúdio, Online…"
                error={!!errors.location}
                helperText={errors.location?.message}
                fullWidth
              />
            )}
          />
        </Stack>
      </AppDialogContent>

      <AppDialogActions>
        <Button onClick={handleClose} variant="outlined" sx={{ borderRadius: 999 }}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit(onSubmit)}
          variant="contained"
          disableElevation
          disabled={!isValid || isSubmitting}
          sx={{ borderRadius: 999, fontWeight: 700 }}
        >
          Salvar
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}

function EventDay(props: PickersDayProps & { highlights?: HighlightMap }) {
  const { day, outsideCurrentMonth, highlights = {}, selected, ...other } = props;
  const key = day.format('YYYY-MM-DD');
  const events = !outsideCurrentMonth ? (highlights[key] ?? 0) : 0;
  const isHighlighted = events > 0;

  return (
    <PickersDay
      {...other}
      day={day}
      selected={selected}
      outsideCurrentMonth={outsideCurrentMonth}
      disableMargin
      sx={(theme) => ({
        boxSizing: 'border-box',
        width: 44,
        height: 44,
        lineHeight: 1,
        fontWeight: 600,
        mx: 0,
        borderRadius: 8,
        position: 'relative',
        '&:hover': { backgroundColor: 'action.hover' },
        ...(day.isSame(dayjs(), 'day') && {
          boxShadow: `inset 0 0 0 2px ${theme.palette.primary.main}`,
        }),
        ...(selected && {
          bgcolor: 'primary.main',
          color: '#fff',
          '&:hover, &:focus': { bgcolor: 'primary.main' },
          boxShadow: 'none',
        }),
        ...(isHighlighted && {
          '&::after': {
            content: '""',
            position: 'absolute',
            left: '50%',
            bottom: 6,
            transform: 'translateX(-50%)',
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: selected ? '#fff' : theme.palette.primary.main,
          },
        }),
      })}
    />
  );
}

export default function Schedule() {
  const [value, setValue] = useState<Dayjs | null>(dayjs());
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const highlights = useMemo<HighlightMap>(() => {
    const base = [6, 8, 20, 25];
    const map: HighlightMap = {};
    base.forEach((d) => {
      const k = dayjs().date(d).format('YYYY-MM-DD');
      map[k] = (map[k] ?? 0) + 1;
    });
    return map;
  }, []);

  const handleCreate = (data: FormValues) => {
    console.log('Novo agendamento:', {
      ...data,
      startISO: data.start?.toISOString(),
      endISO: data.end?.toISOString(),
    });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 2, sm: 3 } }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
          <EventNoteRoundedIcon fontSize="small" />
          <Typography variant="h6" fontWeight={700}>Agendamentos</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {value ? value.format('dddd, DD [de] MMMM [de] YYYY') : 'Selecione uma data'}
        </Typography>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'center' }}
          mb={2.5}
        >
          <TextField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar agendamentos"
            size="small"
            fullWidth
            sx={{ flex: 3 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon />
                </InputAdornment>
              ),
            }}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={1.5} justifyContent="flex-end">
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              sx={{ borderRadius: 999, height: 44, px: 2.5 }}
              onClick={() => setDialogOpen(true)}
            >
              Novo Agendamento
            </Button>
            <Button
              variant="outlined"
              startIcon={<FilterListRoundedIcon />}
              sx={{ borderRadius: 2, height: 44, px: 2.5, bgcolor: '#fff' }}
            >
              Filtros
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
          <Chip label="Hoje" onClick={() => setValue(dayjs())} />
          <Chip label="Próximos 7 dias" onClick={() => setValue(dayjs())} variant="outlined" />
          <Chip label="Com eventos" variant="outlined" />
        </Stack>
        <Divider sx={{ mb: 2 }} />

        <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, p: { xs: 1.5, sm: 2 }, bgcolor: '#fff' }}>
          <DateCalendar
            value={value}
            onChange={setValue}
            views={['day']}
            sx={{
              width: '100%',
              '& .MuiPickersCalendarHeader-root': { px: 1 },
              '& .MuiPickersCalendarHeader-label': { fontWeight: 800, fontSize: 16 },
              '& .MuiDayCalendar-weekDayLabel': { color: 'text.secondary', fontWeight: 600 },
              '& .MuiDayCalendar-monthContainer': { pt: 1 },
              '& .MuiPickersSlideTransition-root': { minHeight: 320 },
              '& .MuiPickersArrowSwitcher-root': {
                gap: 1.5,
                '& button': {
                  bgcolor: 'primary.main',
                  color: '#fff',
                  borderRadius: 2,
                  width: 44,
                  height: 44,
                  '&:hover': { bgcolor: 'primary.main' },
                },
              },
            }}
            slots={{
              day: (dayProps) => <EventDay {...dayProps} highlights={highlights} />,
              leftArrowIcon: ArrowBackRoundedIcon,
              rightArrowIcon: ArrowForwardRoundedIcon,
            }}
            slotProps={{
              day: { disableMargin: true } as Partial<PickersDayProps>,
            }}
          />
        </Paper>
      </Box>

      <NewAppointmentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
        defaultStart={value ? value.hour(9).minute(0).second(0) : dayjs().hour(9).minute(0)}
      />
    </LocalizationProvider>
  );
}
