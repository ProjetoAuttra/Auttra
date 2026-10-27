import * as React from "react";
import { Box, ButtonBase, InputAdornment, Stack, TextField, Typography } from "@mui/material";

export const COR_PADRAO = "#1e3a8a";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Texto legível (preto ou branco) sobre a cor, pela luminância relativa. */
export function textoSobreCor(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#111827" : "#ffffff";
}

type Props = {
  /** Cor atual em #RRGGBB, ou null para a cor padrão. */
  value: string | null;
  onChange: (cor: string | null) => void;
};

/** Escolha da cor principal (seletor + hex) ao lado da prévia de como o total fica nos documentos. */
export default function SeletorCor({ value, onChange }: Props) {
  const atual = value && HEX.test(value) ? value.toLowerCase() : COR_PADRAO;
  const ehPadrao = !value;
  const [texto, setTexto] = React.useState(atual.toUpperCase());

  // Mantém o campo de texto em sincronia quando a cor muda por fora (seletor, restaurar padrão, carregar dados).
  React.useEffect(() => setTexto(atual.toUpperCase()), [atual]);

  const digitado = (bruto: string) => {
    const limpo = "#" + bruto.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    setTexto(limpo.toUpperCase());
    if (HEX.test(limpo)) onChange(limpo.toLowerCase());
  };

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems={{ xs: "stretch", sm: "flex-start" }}>
      <Stack spacing={1} sx={{ width: { xs: "100%", sm: 200 }, flexShrink: 0 }}>
        <TextField
          label="Cor principal"
          value={texto}
          onChange={(e) => digitado(e.target.value)}
          error={!HEX.test(texto)}
          helperText={HEX.test(texto) ? " " : "Use o formato #RRGGBB"}
          inputProps={{ maxLength: 7, "aria-label": "Código hexadecimal da cor" }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <input
                  type="color"
                  aria-label="Escolher cor"
                  value={atual}
                  onChange={(e) => onChange(e.target.value.toLowerCase())}
                  style={{ width: 24, height: 24, padding: 0, border: 0, background: "none", cursor: "pointer" }}
                />
              </InputAdornment>
            ),
          }}
        />
        {!ehPadrao && (
          <ButtonBase onClick={() => onChange(null)} sx={{ alignSelf: "flex-start", fontSize: 13, color: "primary.main" }}>
            Restaurar padrão
          </ButtonBase>
        )}
      </Stack>

      <Box
        data-testid="previa-cor"
        sx={{ flex: 1, minWidth: 0, maxWidth: 360, border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 2, p: 2 }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1, textTransform: "uppercase" }}>
          Prévia no PDF
        </Typography>
        <Box sx={{ borderTop: `2px solid ${atual}`, mt: 0.75, pt: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography fontWeight={700} sx={{ color: atual }}>
            Orçamento Nº 0001
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Faixas, títulos e total
          </Typography>
        </Box>
        <Box
          sx={{
            mt: 1.5,
            ml: "auto",
            width: 200,
            px: 1.5,
            py: 1,
            borderRadius: 1,
            bgcolor: atual,
            color: textoSobreCor(atual),
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 700,
          }}
        >
          <span>Total</span>
          <span>R$ 880,00</span>
        </Box>
      </Box>
    </Stack>
  );
}
