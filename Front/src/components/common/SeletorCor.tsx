import { Box, ButtonBase, Stack, Tooltip, Typography } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

export const COR_PADRAO = "#1e3a8a";

export const CORES_SUGERIDAS = [
  { nome: "Azul-marinho", valor: "#1e3a8a" },
  { nome: "Azul", valor: "#2563eb" },
  { nome: "Verde", valor: "#15803d" },
  { nome: "Verde-água", valor: "#0f766e" },
  { nome: "Laranja", valor: "#c2410c" },
  { nome: "Vermelho", valor: "#be123c" },
  { nome: "Roxo", valor: "#6d28d9" },
  { nome: "Grafite", valor: "#1f2937" },
];

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

/** Escolha da cor principal: sugestões, seletor livre e prévia de como o total fica nos documentos. */
export default function SeletorCor({ value, onChange }: Props) {
  const atual = value && HEX.test(value) ? value.toLowerCase() : COR_PADRAO;
  const ehPadrao = !value;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
        {CORES_SUGERIDAS.map((c) => {
          const selecionada = atual === c.valor && (!ehPadrao || c.valor === COR_PADRAO);
          return (
            <Tooltip key={c.valor} title={c.nome}>
              <ButtonBase
                aria-label={c.nome}
                aria-pressed={selecionada}
                onClick={() => onChange(c.valor === COR_PADRAO ? null : c.valor)}
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  bgcolor: c.valor,
                  color: textoSobreCor(c.valor),
                  boxShadow: selecionada ? `0 0 0 2px #fff, 0 0 0 4px ${c.valor}` : "inset 0 0 0 1px rgba(0,0,0,0.12)",
                }}
              >
                {selecionada && <CheckRoundedIcon sx={{ fontSize: 18 }} />}
              </ButtonBase>
            </Tooltip>
          );
        })}

        <Tooltip title="Escolher outra cor">
          <Box
            component="label"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              ml: 1,
              px: 1.25,
              height: 34,
              borderRadius: 999,
              border: (t) => `1px solid ${t.palette.divider}`,
              cursor: "pointer",
              fontSize: 13,
              color: "text.secondary",
            }}
          >
            <input
              type="color"
              aria-label="Escolher outra cor"
              value={atual}
              onChange={(e) => onChange(e.target.value.toLowerCase())}
              style={{ width: 20, height: 20, padding: 0, border: 0, background: "none", cursor: "pointer" }}
            />
            {atual.toUpperCase()}
          </Box>
        </Tooltip>

        {!ehPadrao && (
          <ButtonBase onClick={() => onChange(null)} sx={{ fontSize: 13, color: "primary.main", ml: 0.5, px: 0.5 }}>
            Restaurar padrão
          </ButtonBase>
        )}
      </Stack>

      <Box
        data-testid="previa-cor"
        sx={{ border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 2, p: 2, maxWidth: 360 }}
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
