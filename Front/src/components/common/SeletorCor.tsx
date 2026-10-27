import * as React from "react";
import { Box, Button, ButtonBase, Stack, Typography } from "@mui/material";
import ColorLensRoundedIcon from "@mui/icons-material/ColorLensRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { AppDialog, AppDialogActions, AppDialogContent } from "./AppDialog";

export const COR_PADRAO = "#1e3a8a";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Texto legível (preto ou branco) sobre a cor, pela luminância relativa. */
export function textoSobreCor(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#111827" : "#ffffff";
}

function PreviaPdf({ cor }: { cor: string }) {
  return (
    <Box data-testid="previa-cor" sx={{ border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 2, p: 2, bgcolor: "background.paper" }}>
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1, textTransform: "uppercase" }}>
        Prévia no PDF
      </Typography>
      <Box sx={{ borderTop: `2px solid ${cor}`, mt: 0.75, pt: 1, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
        <Typography fontWeight={700} sx={{ color: cor }} noWrap>
          Orçamento Nº 0001
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          Faixas, títulos e total
        </Typography>
      </Box>
      <Box
        sx={{
          mt: 1.5,
          ml: "auto",
          width: 200,
          maxWidth: "100%",
          px: 1.5,
          py: 1,
          borderRadius: 1,
          bgcolor: cor,
          color: textoSobreCor(cor),
          display: "flex",
          justifyContent: "space-between",
          fontWeight: 700,
        }}
      >
        <span>Total</span>
        <span>R$ 880,00</span>
      </Box>
    </Box>
  );
}

type DialogProps = {
  open: boolean;
  atual: string;
  personalizada: boolean;
  onClose: () => void;
  onApply: (cor: string | null) => void;
};

function DialogCor({ open, atual, personalizada, onClose, onApply }: DialogProps) {
  const [rascunho, setRascunho] = React.useState(atual);

  // Cada abertura começa da cor atual.
  React.useEffect(() => {
    if (open) setRascunho(atual);
  }, [open, atual]);

  const valida = HEX.test(rascunho);
  const cor = valida ? rascunho.toLowerCase() : atual;

  return (
    <AppDialog open={open} onClose={onClose} onCloseClick={onClose} maxWidth="md" fullWidth title="Cor principal" confirmDiscard={false}>
      <AppDialogContent>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
          <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                "& .react-colorful": { width: "100%", height: 190 },
                "& .react-colorful__saturation": { borderRadius: "12px 12px 0 0" },
                "& .react-colorful__hue": { height: 14, borderRadius: "0 0 12px 12px" },
                "& .react-colorful__pointer": { width: 22, height: 22, borderWidth: 3 },
              }}
            >
              <HexColorPicker color={cor} onChange={setRascunho} aria-label="Seletor de cor" />
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1, textTransform: "uppercase" }}>
                Código hexadecimal
              </Typography>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: cor, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)", flexShrink: 0 }} />
                <Box
                  sx={{
                    flex: 1,
                    "& input": {
                      width: "100%",
                      height: 40,
                      boxSizing: "border-box",
                      px: 1.5,
                      fontSize: 15,
                      fontFamily: "inherit",
                      textTransform: "uppercase",
                      border: (t: any) => `1px solid ${valida ? t.palette.divider : t.palette.error.main}`,
                      borderRadius: 1.5,
                      outline: "none",
                      background: "transparent",
                      color: "inherit",
                    },
                    "& input:focus": { borderColor: "primary.main", boxShadow: (t: any) => `0 0 0 2px ${t.palette.primary.main}33` },
                  }}
                >
                  <HexColorInput color={rascunho} onChange={setRascunho} prefixed aria-label="Código hexadecimal da cor" />
                </Box>
              </Stack>
              {!valida && (
                <Typography variant="caption" color="error">
                  Use o formato #RRGGBB
                </Typography>
              )}
            </Box>
          </Stack>

          <Box sx={{ width: { xs: "100%", sm: 300 }, flexShrink: 0 }}>
            <PreviaPdf cor={cor} />
          </Box>
        </Stack>
      </AppDialogContent>

      <AppDialogActions sx={{ justifyContent: "space-between" }}>
        <Button onClick={() => onApply(null)} disabled={!personalizada && cor === COR_PADRAO} color="inherit">
          Restaurar padrão
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose} variant="outlined">
            Cancelar
          </Button>
          <Button onClick={() => onApply(cor === COR_PADRAO ? null : cor)} variant="contained" disableElevation disabled={!valida} sx={{ fontWeight: 700 }}>
            Aplicar
          </Button>
        </Stack>
      </AppDialogActions>
    </AppDialog>
  );
}

type Props = {
  /** Cor atual em #RRGGBB, ou null para a cor padrão. */
  value: string | null;
  onChange: (cor: string | null) => void;
};

/** Card clicável com a cor atual e a prévia do PDF; a escolha (seletor e hex) acontece no modal. */
export default function SeletorCor({ value, onChange }: Props) {
  const [aberto, setAberto] = React.useState(false);
  const atual = value && HEX.test(value) ? value.toLowerCase() : COR_PADRAO;

  return (
    <>
      <ButtonBase
        onClick={() => setAberto(true)}
        aria-label="Alterar cor principal"
        sx={{
          display: "block",
          width: "100%",
          textAlign: "left",
          borderRadius: 2,
          border: (t) => `1px solid ${t.palette.divider}`,
          p: 2,
          transition: "border-color .15s, box-shadow .15s",
          "&:hover, &:focus-visible": { borderColor: "primary.main", boxShadow: (t) => `0 0 0 3px ${t.palette.primary.main}1f` },
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems={{ xs: "stretch", sm: "center" }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: { sm: 240 }, flexShrink: 0 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: atual,
                color: textoSobreCor(atual),
                display: "grid",
                placeItems: "center",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)",
                flexShrink: 0,
              }}
            >
              <ColorLensRoundedIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" color="text.secondary">
                Cor principal
              </Typography>
              <Typography fontWeight={700}>{atual.toUpperCase()}</Typography>
              <Typography variant="caption" color="primary" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                <EditRoundedIcon sx={{ fontSize: 13 }} /> {value ? "Alterar" : "Padrão · alterar"}
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ flex: 1, minWidth: 0, maxWidth: 360 }}>
            <PreviaPdf cor={atual} />
          </Box>
        </Stack>
      </ButtonBase>

      <DialogCor
        open={aberto}
        atual={atual}
        personalizada={!!value}
        onClose={() => setAberto(false)}
        onApply={(cor) => {
          onChange(cor);
          setAberto(false);
        }}
      />
    </>
  );
}
