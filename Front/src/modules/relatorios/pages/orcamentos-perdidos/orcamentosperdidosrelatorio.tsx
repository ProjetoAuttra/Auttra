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
  firstDayOfMonthISO,
  inDateRange,
  MetricCard,
  percent,
  PeriodFilter,
  ReportHeader,
  ReportPage,
  todayISO,
} from "../../shared/reportUtils";

type Orcamento = {
  id: number;
  descricao?: string | null;
  valor: number | string;
  data?: string | null;
  status: "analise" | "aprovado" | "recusado" | string;
  cliente?: { nome?: string | null; telefone?: string | null } | null;
  veiculo?: { modelo?: string | null; placa?: string | null } | null;
  itens?: Array<{ tipo_item?: string | null; nome?: string | null; servico?: { nome?: string | null } | null; peca?: { nome?: string | null } | null; subtotal?: number | string | null }>;
};

const statusLabel: Record<string, string> = {
  analise: "Em analise",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

const statusColor = (status: string) => {
  if (status === "aprovado") return "success" as const;
  if (status === "recusado") return "error" as const;
  return "warning" as const;
};

export default function OrcamentosPerdidosRelatorio() {
  const { user } = useAuth();
  const { error, warning } = useToast();
  const [orcamentos, setOrcamentos] = React.useState<Orcamento[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dataInicio, setDataInicio] = React.useState(firstDayOfMonthISO());
  const [dataFim, setDataFim] = React.useState(todayISO());
  const [statusFiltro, setStatusFiltro] = React.useState("perdidos");

  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/orcamentos", { params: { oficina_id: user?.oficina_id } });
        setOrcamentos(data ?? []);
      } catch (err) {
        console.error("Erro ao carregar orcamentos perdidos:", err);
        error("Nao foi possivel carregar os orcamentos.");
      } finally {
        setLoading(false);
      }
    })();
  }, [error]);

  const noPeriodo = orcamentos.filter((o) => inDateRange(o.data, dataInicio, dataFim));
  const perdidos = noPeriodo.filter((o) => o.status === "recusado");
  const pendentes = noPeriodo.filter((o) => o.status === "analise");
  const aprovados = noPeriodo.filter((o) => o.status === "aprovado");
  const potencialTotal = noPeriodo.reduce((sum, o) => sum + Number(o.valor ?? 0), 0);
  const valorPerdido = perdidos.reduce((sum, o) => sum + Number(o.valor ?? 0), 0);
  const valorPendente = pendentes.reduce((sum, o) => sum + Number(o.valor ?? 0), 0);
  const taxaConversao = noPeriodo.length ? (aprovados.length / noPeriodo.length) * 100 : 0;

  const linhas = noPeriodo
    .filter((o) => {
      if (statusFiltro === "perdidos") return o.status === "recusado";
      if (statusFiltro === "pendentes") return o.status === "analise";
      return true;
    })
    .sort((a, b) => {
      if (a.status === "analise" && b.status !== "analise") return -1;
      if (a.status !== "analise" && b.status === "analise") return 1;
      return Number(b.valor ?? 0) - Number(a.valor ?? 0);
    });

  const servicosPerdidos = perdidos.reduce<Record<string, { qtd: number; valor: number }>>((acc, o) => {
    const itens = o.itens?.length ? o.itens : [{ nome: o.descricao ?? "Sem item", subtotal: o.valor }];
    itens.forEach((item) => {
      const nome = item.nome ?? item.servico?.nome ?? item.peca?.nome ?? "Item sem nome";
      acc[nome] = acc[nome] ?? { qtd: 0, valor: 0 };
      acc[nome].qtd += 1;
      acc[nome].valor += Number(item.subtotal ?? 0);
    });
    return acc;
  }, {});

  const handleExportarCSV = () => {
    if (!linhas.length) {
      warning("Nenhum orcamento para exportar.");
      return;
    }
    exportCsv(
      `relatorio_orcamentos_perdidos_${dataInicio}_${dataFim}.csv`,
      ["Orcamento", "Cliente", "Telefone", "Veiculo", "Status", "Data", "Dias sem resposta", "Valor", "Descricao"],
      linhas.map((o) => [
        `#${o.id}`,
        o.cliente?.nome ?? "",
        o.cliente?.telefone ?? "",
        [o.veiculo?.modelo, o.veiculo?.placa].filter(Boolean).join(" "),
        statusLabel[o.status] ?? o.status,
        dateBr(o.data),
        o.status === "analise" ? daysBetween(o.data) : "",
        Number(o.valor ?? 0).toFixed(2).replace(".", ","),
        o.descricao ?? "",
      ])
    );
  };

  if (loading) return <Box sx={{ textAlign: "center", mt: 6 }}><CircularProgress /></Box>;

  return (
    <ReportPage>
      <ReportHeader
        title="Relatorio de Orcamentos Perdidos"
        subtitle="Mostra dinheiro que nao virou venda e pendencias que ainda podem ser recuperadas."
        onExport={handleExportarCSV}
      />

      <PeriodFilter dataInicio={dataInicio} dataFim={dataFim} onDataInicio={setDataInicio} onDataFim={setDataFim}>
        <Select size="small" value={statusFiltro} onChange={(e: SelectChangeEvent) => setStatusFiltro(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="perdidos">Perdidos</MenuItem>
          <MenuItem value="pendentes">Pendentes</MenuItem>
          <MenuItem value="todos">Todos</MenuItem>
        </Select>
      </PeriodFilter>

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} mb={2.5}>
        <MetricCard label="Orcamentos" value={noPeriodo.length} />
        <MetricCard label="Valor perdido" value={brl(valorPerdido)} tone={valorPerdido ? "error" : "default"} />
        <MetricCard label="Pendente para recuperar" value={brl(valorPendente)} tone={valorPendente ? "warning" : "default"} />
        <MetricCard label="Conversao" value={percent(taxaConversao)} tone={taxaConversao >= 50 ? "success" : "warning"} helper={`${aprovados.length} aprovado(s)`} />
        <MetricCard label="Potencial total" value={brl(potencialTotal)} tone="info" />
      </Stack>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={2.5} mb={2.5}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1 }}>
          <Typography fontWeight={800} mb={1}>Principais perdas por item</Typography>
          {Object.entries(servicosPerdidos).length ? Object.entries(servicosPerdidos)
            .sort((a, b) => b[1].valor - a[1].valor)
            .slice(0, 8)
            .map(([nome, item]) => (
              <Stack key={nome} direction="row" justifyContent="space-between" gap={2} py={0.75}>
                <Typography variant="body2" noWrap>{nome}</Typography>
                <Typography variant="body2" fontWeight={800}>{item.qtd} - {brl(item.valor)}</Typography>
              </Stack>
            )) : <Typography variant="body2" color="text.secondary">Nenhum orcamento perdido no periodo.</Typography>}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1 }}>
          <Typography fontWeight={800} mb={1}>Follow-up prioritario</Typography>
          {pendentes.length ? [...pendentes]
            .sort((a, b) => daysBetween(b.data) - daysBetween(a.data) || Number(b.valor ?? 0) - Number(a.valor ?? 0))
            .slice(0, 8)
            .map((o) => (
              <Stack key={o.id} direction="row" justifyContent="space-between" gap={2} py={0.75}>
                <Stack minWidth={0}>
                  <Typography variant="body2" fontWeight={700} noWrap>{o.cliente?.nome ?? "Cliente nao informado"}</Typography>
                  <Typography variant="caption" color="text.secondary">{daysBetween(o.data)} dia(s) em analise</Typography>
                </Stack>
                <Typography variant="body2" fontWeight={800}>{brl(Number(o.valor ?? 0))}</Typography>
              </Stack>
            )) : <Typography variant="body2" color="text.secondary">Nenhum orcamento pendente no periodo.</Typography>}
        </Paper>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: "auto" }}>
        {linhas.length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Orcamento</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Telefone</TableCell>
                <TableCell>Veiculo</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Data</TableCell>
                <TableCell align="right">Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {linhas.map((o) => (
                <TableRow key={o.id} hover>
                  <TableCell sx={{ fontWeight: 800 }}>#{o.id}</TableCell>
                  <TableCell>{o.cliente?.nome ?? "-"}</TableCell>
                  <TableCell>{o.cliente?.telefone ?? "-"}</TableCell>
                  <TableCell>{[o.veiculo?.modelo, o.veiculo?.placa].filter(Boolean).join(" ") || "-"}</TableCell>
                  <TableCell><Chip size="small" label={statusLabel[o.status] ?? o.status} color={statusColor(o.status)} sx={{ fontWeight: 700 }} /></TableCell>
                  <TableCell>{dateBr(o.data)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>{brl(Number(o.valor ?? 0))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <EmptyReport message="Nenhum orcamento encontrado nesse filtro." />}
      </Paper>
    </ReportPage>
  );
}
