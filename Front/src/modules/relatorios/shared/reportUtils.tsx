import * as React from "react";
import StatCard, { StatGroup } from "../../../components/common/StatCard";
export { StatGroup };
import {
  Box,
  Button,
  Stack,
  Typography,
  type SxProps,
  type Theme,
} from "@mui/material";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import { formatarData, paraInputData } from "../../pagamentos/api/api";

export const LIMITE_ESTOQUE_BAIXO = 3;

export const brl = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Data para exibição. Campos só-dia (vencimento, data do orçamento, validade) chegam como meia-noite UTC e são mostrados
 * como data de calendário; instantes com hora real (agendamento, created_at) seguem o fuso local. Mesma regra de formatarData.
 */
export const dateBr = (value?: string | null) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "-";
  return formatarData(value);
};

const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const todayISO = () => isoLocal(new Date());

export const firstDayOfMonthISO = () => {
  const date = new Date();
  return isoLocal(new Date(date.getFullYear(), date.getMonth(), 1));
};

export const lastDayOfMonthISO = () => {
  const date = new Date();
  return isoLocal(new Date(date.getFullYear(), date.getMonth() + 1, 0));
};

/** Período padrão dos relatórios: do dia 1 ao último dia do mês atual. */
export const periodoMesAtual = () => ({ de: firstDayOfMonthISO(), ate: lastDayOfMonthISO() });

export const daysBetween = (from?: string | null, to = new Date()) => {
  if (!from) return 0;
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((to.getTime() - start.getTime()) / 86400000));
};

/**
 * O dia de `value` está entre `from` e `to` (YYYY-MM-DD, inclusivos)? Compara os dias como texto: campos só-dia
 * (meia-noite UTC) usam a fatia UTC e não caem no dia anterior; instantes com hora usam o dia local.
 */
export const inDateRange = (value: string | null | undefined, from: string, to: string) => {
  const dia = paraInputData(value);
  if (!dia) return false;
  return dia >= from && dia <= to;
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
