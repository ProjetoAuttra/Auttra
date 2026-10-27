import type { ReactNode } from "react";
import { Box, Paper, Stack, Typography, type SxProps, type Theme } from "@mui/material";
import { alpha } from "@mui/material/styles";

export type StatTone = "default" | "primary" | "success" | "warning" | "error" | "info";

type Props = {
  label: string;
  value: string | number;
  helper?: string;
  icon?: ReactNode;
  tone?: StatTone;
  /** Torna o card clicável (ex.: filtro rápido). */
  onClick?: () => void;
  /** Marca o card clicável como selecionado. */
  active?: boolean;
  sx?: SxProps<Theme>;
};

/** KPI padrão do sistema: rótulo, valor em destaque e apoio opcional. */
export default function StatCard({ label, value, helper, icon, tone = "default", onClick, active = false, sx }: Props) {
  const valueColor = tone === "default" ? "text.primary" : `${tone}.main`;

  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={[
        {
          px: 2.25,
          py: 1.75,
          borderRadius: 2,
          flex: 1,
          minWidth: 160,
          cursor: onClick ? "pointer" : "default",
          borderColor: active ? "primary.main" : "divider",
          bgcolor: active ? (t: Theme) => alpha(t.palette.primary.main, 0.05) : "background.paper",
          transition: "border-color 0.2s, background-color 0.2s",
          "&:hover": onClick ? { borderColor: "primary.main" } : undefined,
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
      <Typography variant="h6" fontWeight={700} color={valueColor}>
        {value}
      </Typography>
      {helper && (
        <Typography variant="caption" color="text.secondary">
          {helper}
        </Typography>
      )}
    </Paper>
  );
}

/** Agrupa KPIs numa única superfície, separados por divisórias verticais (em vez de várias caixas). */
export function StatGroup({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Paper
      variant="outlined"
      sx={[
        {
          display: "flex",
          flexWrap: "wrap",
          overflow: "hidden",
          mb: 2.5,
          "& > .MuiPaper-root": {
            border: 0,
            borderRadius: 0,
            borderRight: (t: Theme) => `1px solid ${t.palette.divider}`,
            flex: "1 1 170px",
          },
          "& > .MuiPaper-root:last-child": { borderRight: 0 },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Paper>
  );
}
