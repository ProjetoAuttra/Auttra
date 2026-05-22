import * as React from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  type SxProps,
  type Theme,
} from "@mui/material";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import { alpha } from "@mui/material/styles";

export const LIMITE_ESTOQUE_BAIXO = 3;

export const brl = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dateBr = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const firstDayOfMonthISO = () => {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
};

export const daysBetween = (from?: string | null, to = new Date()) => {
  if (!from) return 0;
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((to.getTime() - start.getTime()) / 86400000));
};

export const inDateRange = (value: string | null | undefined, from: string, to: string) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59`);
  return date >= start && date <= end;
};

export const percent = (value: number) =>
  `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const escapeCsv = (value: unknown) => {
  const text = String(value ?? "");
  if (/[;"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

export function exportCsv(fileName: string, header: string[], rows: Array<Array<string | number>>) {
  const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportHeader({
  title,
  subtitle,
  onExport,
}: {
  title: string;
  subtitle: string;
  onExport: () => void;
}) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} mb={3} gap={2}>
      <Stack>
        <Typography variant="h5" fontWeight={700}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
      </Stack>
      <Button variant="contained" startIcon={<FileDownloadRoundedIcon />} onClick={onExport} sx={{ borderRadius: 2, alignSelf: { xs: "flex-start", sm: "center" } }}>
        Exportar CSV
      </Button>
    </Stack>
  );
}

export function PeriodFilter({
  dataInicio,
  dataFim,
  onDataInicio,
  onDataFim,
  children,
}: {
  dataInicio: string;
  dataFim: string;
  onDataInicio: (value: string) => void;
  onDataFim: (value: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }} flexWrap="wrap">
        <TextField type="date" label="De" size="small" value={dataInicio} onChange={(e) => onDataInicio(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField type="date" label="Ate" size="small" value={dataFim} onChange={(e) => onDataFim(e.target.value)} InputLabelProps={{ shrink: true }} />
        {children}
      </Stack>
    </Paper>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  tone = "default",
  sx,
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "default" | "success" | "warning" | "error" | "info";
  sx?: SxProps<Theme>;
}) {
  const colors: Record<string, string> = {
    default: "#64748b",
    success: "#16a34a",
    warning: "#d97706",
    error: "#dc2626",
    info: "#0284c7",
  };
  const color = colors[tone];

  return (
    <Paper
      variant="outlined"
      sx={{
        px: 2.25,
        py: 1.75,
        borderRadius: 2,
        bgcolor: alpha(color, tone === "default" ? 0.025 : 0.055),
        borderColor: alpha(color, tone === "default" ? 0.16 : 0.24),
        minWidth: 180,
        flex: 1,
        ...sx,
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: 0 }}>
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={800} color={tone === "default" ? "text.primary" : color}>
        {value}
      </Typography>
      {helper && <Typography variant="caption" color="text.secondary">{helper}</Typography>}
    </Paper>
  );
}

export function ReportPage({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ maxWidth: 1500, mx: "auto", px: { xs: 2, sm: 3, md: 4 }, py: { xs: 2.5, md: 3 } }}>
      {children}
    </Box>
  );
}

export function EmptyReport({ message }: { message: string }) {
  return (
    <Box sx={{ textAlign: "center", py: 6 }}>
      <Typography color="text.secondary">{message}</Typography>
    </Box>
  );
}
