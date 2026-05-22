import * as React from "react";
import {
  Box,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../context/ToastContext";
import {
  brl,
  dateBr,
  daysBetween,
  EmptyReport,
  exportCsv,
  MetricCard,
  ReportHeader,
  ReportPage,
} from "../../shared/reportUtils";

type Ordem = {
  id: number;
  status?: string | null;
  data_abertura?: string | null;
  valor_total?: number | string | null;
  cliente?: { nome?: string | null } | null;
  veiculo?: { marca?: string | null; modelo?: string | null; placa?: string | null } | null;
  funcionario?: { nome?: string | null } | null;
};

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluida",
  cancelada: "Cancelada",
};

const statusColor = (status?: string | null) => {
  if (status === "em_andamento") return "info" as const;
  if (status === "concluida") return "success" as const;
  if (status === "cancelada") return "error" as const;
  return "warning" as const;
};

export default function OrdensParadasRelatorio() {
  const { user } = useAuth();
  const { error, warning } = useToast();
  const [ordens, setOrdens] = React.useState<Ordem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [diasMinimos, setDiasMinimos] = React.useState("3");

  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/ordens", { params: { oficina_id: user?.oficina_id } });
        setOrdens(data ?? []);
      } catch (err) {
        console.error("Erro ao carregar ordens paradas:", err);
        error("Nao foi possivel carregar as ordens de servico.");
      } finally {
        setLoading(false);
      }
    })();
  }, [error]);

  const abertas = ordens.filter((o) => o.status !== "concluida" && o.status !== "cancelada");
  const paradas = abertas
    .filter((o) => daysBetween(o.data_abertura) >= Number(diasMinimos))
    .sort((a, b) => daysBetween(b.data_abertura) - daysBetween(a.data_abertura));
  const valorPreso = abertas.reduce((sum, o) => sum + Number(o.valor_total ?? 0), 0);
  const valorParado = paradas.reduce((sum, o) => sum + Number(o.valor_total ?? 0), 0);
  const acima7Dias = abertas.filter((o) => daysBetween(o.data_abertura) >= 7).length;
  const maiorValorAberto = [...abertas].sort((a, b) => Number(b.valor_total ?? 0) - Number(a.valor_total ?? 0))[0];

  const porMecanico = paradas.reduce<Record<string, { qtd: number; valor: number }>>((acc, o) => {
    const nome = o.funcionario?.nome ?? "Sem mecanico";
    acc[nome] = acc[nome] ?? { qtd: 0, valor: 0 };
    acc[nome].qtd += 1;
    acc[nome].valor += Number(o.valor_total ?? 0);
    return acc;
  }, {});

  const handleExportarCSV = () => {
    if (!paradas.length) {
      warning("Nenhuma OS parada para exportar.");
      return;
    }
    exportCsv(
      `relatorio_ordens_abertas_paradas_${new Date().toISOString().slice(0, 10)}.csv`,
      ["OS", "Cliente", "Veiculo", "Mecanico", "Status", "Data abertura", "Dias aberta", "Valor"],
      paradas.map((o) => [
        `#${o.id}`,
        o.cliente?.nome ?? "",
        [o.veiculo?.marca, o.veiculo?.modelo, o.veiculo?.placa].filter(Boolean).join(" "),
        o.funcionario?.nome ?? "",
        STATUS_LABEL[o.status ?? ""] ?? o.status ?? "",
        dateBr(o.data_abertura),
        daysBetween(o.data_abertura),
        Number(o.valor_total ?? 0).toFixed(2).replace(".", ","),
      ])
    );
  };

  if (loading) return <Box sx={{ textAlign: "center", mt: 6 }}><CircularProgress /></Box>;

  return (
    <ReportPage>
      <ReportHeader
        title="Relatorio de OS em Aberto e Paradas"
        subtitle="Lista o trabalho que esta parado, ha quantos dias esta aberto e quanto dinheiro esta preso."
        onExport={handleExportarCSV}
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
          <Typography variant="body2" fontWeight={700}>Considerar parada a partir de</Typography>
          <Select size="small" value={diasMinimos} onChange={(e: SelectChangeEvent) => setDiasMinimos(e.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="1">1 dia</MenuItem>
            <MenuItem value="3">3 dias</MenuItem>
            <MenuItem value="5">5 dias</MenuItem>
            <MenuItem value="7">7 dias</MenuItem>
          </Select>
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} mb={2.5}>
        <MetricCard label="OS abertas" value={abertas.length} tone="info" />
        <MetricCard label="OS paradas" value={paradas.length} tone={paradas.length ? "warning" : "default"} helper={`${diasMinimos}+ dia(s)`} />
        <MetricCard label="Criticas" value={acima7Dias} tone={acima7Dias ? "error" : "default"} helper="7+ dias abertas" />
        <MetricCard label="Valor preso" value={brl(valorPreso)} tone={valorPreso > 0 ? "warning" : "default"} />
        <MetricCard label="Valor parado" value={brl(valorParado)} tone={valorParado > 0 ? "error" : "default"} />
      </Stack>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={2.5} mb={2.5}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1 }}>
          <Typography fontWeight={800} mb={1}>Prioridade por valor</Typography>
          {maiorValorAberto ? (
            <Stack spacing={0.5}>
              <Typography variant="body2" fontWeight={700}>OS #{maiorValorAberto.id} - {maiorValorAberto.cliente?.nome ?? "Cliente nao informado"}</Typography>
              <Typography variant="body2" color="text.secondary">{daysBetween(maiorValorAberto.data_abertura)} dia(s) aberta</Typography>
              <Typography fontWeight={900} color="warning.main">{brl(Number(maiorValorAberto.valor_total ?? 0))}</Typography>
            </Stack>
          ) : <Typography variant="body2" color="text.secondary">Nenhuma OS aberta.</Typography>}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1 }}>
          <Typography fontWeight={800} mb={1}>Paradas por mecanico</Typography>
          {Object.entries(porMecanico).length ? Object.entries(porMecanico).map(([nome, item]) => (
            <Stack key={nome} direction="row" justifyContent="space-between" py={0.75}>
              <Typography variant="body2">{nome}</Typography>
              <Typography variant="body2" fontWeight={800}>{item.qtd} OS - {brl(item.valor)}</Typography>
            </Stack>
          )) : <Typography variant="body2" color="text.secondary">Nenhuma OS parada nesse criterio.</Typography>}
        </Paper>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: "auto" }}>
        {paradas.length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>OS</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Veiculo</TableCell>
                <TableCell>Mecanico</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Abertura</TableCell>
                <TableCell align="right">Dias</TableCell>
                <TableCell align="right">Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paradas.map((o) => (
                <TableRow key={o.id} hover>
                  <TableCell sx={{ fontWeight: 800 }}>#{o.id}</TableCell>
                  <TableCell>{o.cliente?.nome ?? "-"}</TableCell>
                  <TableCell>{[o.veiculo?.marca, o.veiculo?.modelo, o.veiculo?.placa].filter(Boolean).join(" ") || "-"}</TableCell>
                  <TableCell>{o.funcionario?.nome ?? "-"}</TableCell>
                  <TableCell><Chip size="small" label={STATUS_LABEL[o.status ?? ""] ?? o.status ?? "-"} color={statusColor(o.status)} sx={{ fontWeight: 700 }} /></TableCell>
                  <TableCell>{dateBr(o.data_abertura)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>{daysBetween(o.data_abertura)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>{brl(Number(o.valor_total ?? 0))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <EmptyReport message="Nenhuma OS parada no criterio selecionado." />}
      </Paper>
    </ReportPage>
  );
}
