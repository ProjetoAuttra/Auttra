import { InputAdornment, TextField, type TextFieldProps } from "@mui/material";
import { useEffect, useState } from "react";
import { lerQuantidade, quantidadeParaTexto } from "../../utils/quantidade";

type Props = Omit<TextFieldProps, "value" | "onChange" | "type"> & {
  value: number | null;
  /** null enquanto o texto não for uma quantidade válida (vazio, "3,", mais de 3 casas...). */
  onChange: (quantidade: number | null) => void;
  unidade?: string | null;
};

/** Campo de quantidade decimal: aceita vírgula, abre o teclado numérico no celular e mostra a unidade. */
export default function CampoQuantidade({ value, onChange, unidade, slotProps, ...props }: Props) {
  const [texto, setTexto] = useState(value == null ? "" : quantidadeParaTexto(value));

  // Valor trocado por fora (ex.: item recarregado): reflete no campo sem atropelar a digitação.
  useEffect(() => {
    if (value != null && lerQuantidade(texto) !== value) setTexto(quantidadeParaTexto(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <TextField
      {...props}
      value={texto}
      onChange={(e) => {
        const t = e.target.value;
        if (!/^[\d.,]*$/.test(t)) return;
        setTexto(t);
        onChange(lerQuantidade(t));
      }}
      slotProps={{
        ...slotProps,
        htmlInput: { inputMode: "decimal", ...(slotProps?.htmlInput as object) },
        input: unidade
          ? { endAdornment: <InputAdornment position="end">{unidade}</InputAdornment>, ...(slotProps?.input as object) }
          : slotProps?.input,
      }}
    />
  );
}
