import * as React from "react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DesktopDatePicker } from "@mui/x-date-pickers/DesktopDatePicker";

const INICIAIS = ["D", "S", "T", "Q", "Q", "S", "S"];

type Props = {
  label: string;
  /** Data no formato YYYY-MM-DD, ou "" quando vazia. */
  value: string;
  onChange: (valor: string) => void;
  error?: boolean;
  helperText?: React.ReactNode;
  disabled?: boolean;
  autoFocus?: boolean;
};

/**
 * Campo de data com calendário próprio (em vez do seletor nativo do navegador).
 * Trabalha com strings YYYY-MM-DD, o mesmo formato que a API usa, e mostra DD/MM/AAAA.
 */
export default function CampoData({ label, value, onChange, error, helperText, disabled, autoFocus }: Props) {
  const data = value ? dayjs(value) : null;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
      <DesktopDatePicker
        label={label}
        value={data && data.isValid() ? data : null}
        onChange={(d) => onChange(d && d.isValid() ? d.format("YYYY-MM-DD") : "")}
        format="DD/MM/YYYY"
        // Em pt-BR a abreviação padrão vira "2ª", "3ª"...; usa a inicial de cada dia.
        dayOfWeekFormatter={(dia) => INICIAIS[dia.day()]}
        disabled={disabled}
        localeText={{ todayButtonLabel: "Hoje", clearButtonLabel: "Limpar" }}
        slotProps={{
          textField: { size: "small", fullWidth: true, error, helperText, autoFocus },
          actionBar: { actions: ["clear", "today"] },
        }}
      />
    </LocalizationProvider>
  );
}
