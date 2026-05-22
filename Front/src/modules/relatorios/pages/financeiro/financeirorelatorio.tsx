import * as React from "react";
import {
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../context/ToastContext";
import {
  brl,
  dateBr,
  EmptyReport,
  exportCsv,
  firstDayOfMonthISO,
  inDateRange,
  MetricCard,
  PeriodFilter,
  ReportHeader,
  ReportPage,
  todayISO,
} from "../../shared/reportUtils";

type Pagamento = {
  id: number;
  tipo: "pagar" | "receber" | string;
  metodo?: string | null;
  valor: number;
  valor_pago?: number | null;
  status?: string | null;
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  categoria?: string | null;
  descricao?: string | null;
  cliente?: { nome?: string | null } | null;
  fornecedor?: { nome?: string | null } | null;
};

const isReceber = (p: Pagamento) => p.tipo === "receber" || p.tipo === "entrada";
const isPagar = (p: Pagamento) => p.tipo === "pagar" || p.tipo === "saida";
const isPago = (p: Pagamento) => p.status === "pago";
const isPendente = (p: Pagamento) => p.status === "pendente" || p.status === "parcial";
const valorPago = (p: Pagamento) => Number(p.valor_pago ?? 0) || (isPago(p) ? Number(p.valor ?? 0) : 0);
const valorAberto = (p: Pagamento) => Math.max(0, Number(p.valor ?? 0) - Number(p.valor_pago ?? 0));
const dataReferencia = (p: Pagamento) => p.data_pagamento ?? p.data_vencimento;

export default function RelatorioFinanceiro() {
  const { user } = useAuth();
  const { warning, error } = useToast();
  const [dataInicio, setDataInicio] = React.useState(firstDayOfMonthISO());
  const [dataFim, setDataFim] = React.useState(todayISO());
  const [dados, setDados] = React.useState<Pagamento[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user?.oficina_id) return;

    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/pagamentos", { params: { oficina_id: user.oficina_id } });
        setDados((data ?? []).map((p: any) => ({
          ...p,
          valor: Number(p.valor ?? 0),
          valor_pago: Number(p.valor_pago ?? 0),
          tipo: (p.tipo ?? "").toLowerCase(),
          status: (p.status ?? "").toLowerCase(),
        })));
      } catch (err) {
        console.error("Erro ao carregar pagamentos:", err);
        error("Nao foi possivel carregar o relatorio financeiro.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.oficina_id, error]);

  const filtrados = React.useMemo(
    () => dados.filter((p) => inDateRange(dataReferencia(p), dataInicio, dataFim)),
    [dados, dataInicio, dataFim]
  );

  const hoje = new Date(`${todayISO()}T23:59:59`);
  const vencidos = filtrados.filter((p) => isReceber(p) && isPendente(p) && p.data_vencimento && new Date(p.data_vencimento) < hoje);
  const recebido = filtrados.filter((p) => isReceber(p) && isPago(p)).reduce((sum, p) => sum + valorPago(p), 0);
  const aReceber = filtrados.filter((p) => isReceber(p) && isPendente(p)).reduce((sum, p) => sum + valorAberto(p), 0);
  const pago = filtrados.filter((p) => isPagar(p) && isPago(p)).reduce((sum, p) => sum + valorPago(p), 0);
  const aPagar = filtrados.filter((p) => isPagar(p) && isPendente(p)).reduce((sum, p) => sum + valorAberto(p), 0);
  const valorVencido = vencidos.reduce((sum, p) => sum + valorAberto(p), 0);
  const saldoRealizado = recebido - pago;
  const saldoProjetado = recebido + aReceber - pago - aPagar;

  const cobrarPrimeiro = [...vencidos]
    .sort((a, b) => valorAberto(b) - valorAberto(a))
    .slice(0, 10);

  const porMetodo = filtrados
    .filter((p) => isReceber(p) && isPago(p))
    .reduce<Record<string, number>>((acc, p) => {
      const metodo = p.metodo || "sem metodo";
      acc[metodo] = (acc[metodo] ?? 0) + valorPago(p);
      return acc;
    }, {});

  const handleExportarCSV = () => {
    if (!filtrados.length) {
      warning("Nenhum dado para exportar.");
      return;
    }
    exportCsv(
      `relatorio_caixa_inadimplencia_${dataInicio}_${dataFim}.csv`,
      ["Tipo", "Status", "Cliente/Fornecedor", "Descricao", "Valor", "Valor pago", "Vencimento", "Pagamento", "Metodo"],
      filtrados.map((p) => [
        isReceber(p) ? "Receber" : "Pagar",
        p.status ?? "",
        p.cliente?.nome ?? p.fornecedor?.nome ?? "",
        p.descricao ?? p.categoria ?? "",
        Number(p.valor ?? 0).toFixed(2).replace(".", ","),
        Number(p.valor_pago ?? 0).toFixed(2).replace(".", ","),
        dateBr(p.data_vencimento),
        dateBr(p.data_pagamento),
        p.metodo ?? "",
      ])
    );
  };

  if (loading) return <Box sx={{ textAlign: "center", mt: 6 }}><CircularProgress /></Box>;

  return (
    <ReportPage>
      <ReportHeader
        title="Relatorio de Caixa e Inadimplencia"
        subtitle="Mostra o que entrou, o que ainda deve entrar, contas vencidas e pressao de caixa no periodo."
        onExport={handleExportarCSV}
      />

      <PeriodFilter dataInicio={dataInicio} dataFim={dataFim} onDataInicio={setDataInicio} onDataFim={setDataFim} />

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} mb={2.5}>
        <MetricCard label="Recebido" value={brl(recebido)} tone="success" />
        <MetricCard label="A receber" value={brl(aReceber)} tone="info" />
        <MetricCard label="Vencido" value={brl(valorVencido)} tone={valorVencido > 0 ? "error" : "default"} helper={`${vencidos.length} conta(s)`} />
        <MetricCard label="A pagar" value={brl(aPagar)} tone={aPagar > 0 ? "warning" : "default"} />
        <MetricCard label="Saldo projetado" value={brl(saldoProjetado)} tone={saldoProjetado < 0 ? "error" : "success"} helper={`Realizado: ${brl(saldoRealizado)}`} />
      </Stack>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={2.5} mb={2.5}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1 }}>
          <Typography fontWeight={800} mb={1}>Cobrar primeiro</Typography>
          {cobrarPrimeiro.length ? cobrarPrimeiro.map((p) => (
            <Stack key={p.id} direction="row" justifyContent="space-between" alignItems="center" py={0.75} gap={2}>
              <Stack minWidth={0}>
                <Typography variant="body2" fontWeight={700} noWrap>{p.cliente?.nome ?? "Cliente nao informado"}</Typography>
                <Typography variant="caption" color="text.secondary">Venceu em {dateBr(p.data_vencimento)}</Typography>
              </Stack>
              <Typography variant="body2" fontWeight={800} color="error.main">{brl(valorAberto(p))}</Typography>
            </Stack>
          )) : <Typography variant="body2" color="text.secondary">Nenhuma conta vencida no periodo.</Typography>}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1 }}>
          <Typography fontWeight={800} mb={1}>Recebido por forma de pagamento</Typography>
          {Object.entries(porMetodo).length ? Object.entries(porMetodo).map(([metodo, total]) => (
            <Stack key={metodo} direction="row" justifyContent="space-between" py={0.75}>
              <Typography variant="body2" sx={{ textTransform: "capitalize" }}>{metodo.replace("_", " ")}</Typography>
              <Typography variant="body2" fontWeight={800}>{brl(total)}</Typography>
            </Stack>
          )) : <Typography variant="body2" color="text.secondary">Nenhum recebimento pago no periodo.</Typography>}
        </Paper>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: "auto" }}>
        {filtrados.length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Tipo</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Cliente/Fornecedor</TableCell>
                <TableCell>Descricao</TableCell>
                <TableCell align="right">Valor</TableCell>
                <TableCell>Vencimento</TableCell>
                <TableCell>Pagamento</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtrados.map((p) => {
                const vencido = isReceber(p) && isPendente(p) && p.data_vencimento && new Date(p.data_vencimento) < hoje;
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Chip size="small" label={isReceber(p) ? "Receber" : "Pagar"} color={isReceber(p) ? "success" : "warning"} sx={{ fontWeight: 700 }} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={vencido ? "vencido" : p.status || "-"}
                        sx={{
                          fontWeight: 700,
                          bgcolor: (t) => alpha(vencido ? t.palette.error.main : t.palette.text.primary, vencido ? 0.12 : 0.06),
                          color: vencido ? "error.main" : "text.secondary",
                        }}
                      />
                    </TableCell>
                    <TableCell>{p.cliente?.nome ?? p.fornecedor?.nome ?? "-"}</TableCell>
                    <TableCell>{p.descricao ?? p.categoria ?? "-"}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>{brl(Number(p.valor ?? 0))}</TableCell>
                    <TableCell>{dateBr(p.data_vencimento)}</TableCell>
                    <TableCell>{dateBr(p.data_pagamento)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : <EmptyReport message="Nenhum movimento financeiro encontrado no periodo." />}
      </Paper>
    </ReportPage>
  );
}
