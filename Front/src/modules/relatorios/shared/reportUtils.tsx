import * as React from "react";
import StatCard, { StatGroup } from "../../../components/common/StatCard";
export { StatGroup };
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
  type SxProps,
  type Theme,
} from "@mui/material";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";

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
      <Button variant="contained" startIcon={<FileDownloadRoundedIcon />} onClick={onExport} sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}>
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
    <Box sx={{ mb: 2.5 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }} flexWrap="wrap">
        <TextField type="date" label="De" size="small" value={dataInicio} onChange={(e) => onDataInicio(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField type="date" label="Até" size="small" value={dataFim} onChange={(e) => onDataFim(e.target.value)} InputLabelProps={{ shrink: true }} />
        {children}
      </Stack>
    </Box>
  );
}

export function MetricCard(props: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "default" | "success" | "warning" | "error" | "info";
  sx?: SxProps<Theme>;
}) {
  // Os KPIs dos relatórios ficam em preto padrão: a cor fica reservada para status, não para números.
  const { tone: _tone, ...resto } = props;
  return <StatCard {...resto} />;
}

/** Linha de lista de um painel: rótulo (e apoio) à esquerda, valor à direita, separada da próxima por uma linha fina. */
export function LinhaLista({ titulo, apoio, valor }: { titulo: React.ReactNode; apoio?: React.ReactNode; valor: React.ReactNode }) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      gap={2}
      sx={{ py: 1.25, borderBottom: (t) => `1px solid ${t.palette.divider}`, "&:last-of-type": { borderBottom: 0 } }}
    >
      <Stack minWidth={0}>
        <Typography variant="body2" noWrap>{titulo}</Typography>
        {apoio && <Typography variant="caption" color="text.secondary">{apoio}</Typography>}
      </Stack>
      <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: "nowrap" }}>{valor}</Typography>
    </Stack>
  );
}

export function ReportPage({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>
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


/** Título de seção: texto em negrito com uma linha fina embaixo, no lugar da caixa em volta do painel. */
export function TituloSecao({ children }: { children: React.ReactNode }) {
  return (
    <Typography fontWeight={700} sx={{ pb: 1, mb: 1.5, borderBottom: (t) => `1px solid ${t.palette.divider}` }}>
      {children}
    </Typography>
  );
}
