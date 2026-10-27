import type { ReactNode } from "react";
import { Box, Stack, Typography, type SxProps, type Theme } from "@mui/material";
import { alpha } from "@mui/material/styles";

export type StatTone = "default" | "primary" | "success" | "warning" | "error" | "info";

type Props = {
  label: string;
  value: string | number;
  helper?: string;
  icon?: ReactNode;
  tone?: StatTone;
  /** Torna o KPI clicável (ex.: filtro rápido). */
  onClick?: () => void;
  /** Marca o KPI clicável como selecionado. */
  active?: boolean;
  sx?: SxProps<Theme>;
};

/** KPI padrão do sistema: rótulo, valor em destaque e apoio opcional, sem caixa nem borda. */
export default function StatCard({ label, value, helper, icon, tone = "default", onClick, active = false, sx }: Props) {
  const valueColor = tone === "default" ? "text.primary" : `${tone}.main`;

  return (
    <Box
      onClick={onClick}
      sx={[
        {
          px: onClick ? 1.5 : 0,
          py: 0.5,
          borderRadius: 1.5,
          minWidth: 140,
          cursor: onClick ? "pointer" : "default",
          bgcolor: active ? (t: Theme) => alpha(t.palette.primary.main, 0.08) : "transparent",
          transition: "background-color 0.2s",
          "&:hover": onClick ? { bgcolor: active ? undefined : "action.hover" } : undefined,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Stack direction="row" alignItems="center" spacing={0.75} mb={0.25}>
        {icon && <Box sx={{ display: "flex", color: valueColor, "& svg": { fontSize: 18 } }}>{icon}</Box>}
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {label}
        </Typography>
      </Stack>
      <Typography fontSize="1.5rem" lineHeight={1.3} fontWeight={700} color={valueColor}>
        {value}
      </Typography>
      {helper && (
        <Typography variant="caption" color="text.secondary">
          {helper}
        </Typography>
      )}
    </Box>
  );
}

/** Agrupa KPIs numa linha solta, separados por espaço (sem caixas nem divisórias). Com `espalhar`, ocupam a largura toda. */
export function StatGroup({ children, sx, espalhar = false }: { children: ReactNode; sx?: SxProps<Theme>; espalhar?: boolean }) {
  return (
    <Box
      sx={[
        {
          display: "flex",
          flexWrap: "wrap",
          gap: { xs: 3, md: 6 },
          mb: 3,
          // Em telas largas, o primeiro KPI fica na borda esquerda e o último na direita.
          ...(espalhar ? { justifyContent: { md: "space-between" } } : {}),
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Box>
  );
}
