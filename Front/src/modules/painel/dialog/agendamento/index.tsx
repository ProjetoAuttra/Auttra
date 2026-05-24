import * as React from 'react';
import { Button, Stack, TextField } from '@mui/material';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import { Controller, useForm } from 'react-hook-form';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/pt-br';
import { AppDialog, AppDialogActions, AppDialogContent } from '../../../../components/common/AppDialog';

export type TaskForm = {
  title: string;
  dateTime: Dayjs | null;
  description?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (data: TaskForm) => void;
  defaultDate?: Dayjs | null;
};

export default function DialogAgendamento({
  open, onClose, onCreate, defaultDate
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitting }
  } = useForm<TaskForm>({
    mode: 'onChange',
    defaultValues: {
      title: '',
      dateTime: defaultDate ?? dayjs(),
      description: '',
    }
  });

  React.useEffect(() => {
    if (open) {
      reset({
        title: '',
        description: '',
        dateTime: (defaultDate ?? dayjs()).second(0),
      });
    }
  }, [open, defaultDate, reset]);

  const onSubmit = (data: TaskForm) => {
    onCreate(data);
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
      <AppDialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        title="Nova tarefa"
        icon={<CalendarMonthRoundedIcon />}
        variant="entity"
      >
        <AppDialogContent>
          <Stack spacing={2} mt={0.5}>
            <Controller
              name="title"
              control={control}
              rules={{
                required: 'Informe um titulo',
                maxLength: { value: 100, message: 'Max. 100 caracteres' },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Titulo"
                  placeholder="Ex.: Troca de vela - Civic 2009"
                  autoFocus
                  error={!!errors.title}
                  helperText={errors.title?.message}
                  fullWidth
                />
              )}
            />
            <Controller
              name="dateTime"
              control={control}
              rules={{ required: 'Escolha data e hora' }}
              render={({ field }) => (
                <DateTimePicker
                  label="Data e hora"
                  ampm={false}
                  value={field.value}
                  onChange={(newVal) => field.onChange(newVal)}
                  slotProps={{
                    textField: {
                      error: !!errors.dateTime,
                      helperText: errors.dateTime?.message,
                      fullWidth: true,
                    },
                    popper: { placement: 'bottom-start' },
                  }}
                />
              )}
            />
            <Controller
              name="description"
              control={control}
              rules={{ maxLength: { value: 500, message: 'Max. 500 caracteres' } }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Descricao (opcional)"
                  placeholder="Detalhes, observacoes..."
                  multiline
                  minRows={3}
                  error={!!errors.description}
                  helperText={errors.description?.message}
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
            disabled={!isValid || isSubmitting}
            disableElevation
            sx={{ borderRadius: 999 }}
          >
            Salvar
          </Button>
        </AppDialogActions>
      </AppDialog>
    </LocalizationProvider>
  );
}
