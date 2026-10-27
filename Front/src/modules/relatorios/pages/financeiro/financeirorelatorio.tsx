import * as React from "react";
import {
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import api from "../../../../api/api";
import { METODO_LABEL, METODO_OPTIONS } from "../../../pagamentos/api/api";
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
  StatGroup,
  PeriodFilter,
  ReportHeader,
  ReportPage,
  todayISO, TituloSecao } from "../../shared/reportUtils";
import { GraficoPizza, GraficoEntradasSaidas, chaveSemana, rotuloSemana, semanasDoPeriodo } from "../../shared/graficos";

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
        error("Não foi possível carregar o relatório financeiro.");
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

  const porMetodo = filtrados
    .filter((p) => isReceber(p) && isPago(p))
    .reduce<Record<string, number>>((acc, p) => {
      const metodo = p.metodo || "sem método";
      acc[metodo] = (acc[metodo] ?? 0) + valorPago(p);
      return acc;
    }, {});

  const semanasChart = React.useMemo(() => {
    const semanas = semanasDoPeriodo(dataInicio, dataFim);
    const porSemana = new Map(semanas.map((d) => [chaveSemana(d), { rotulo: rotuloSemana(d), entradas: 0, saidas: 0 }]));
    for (const p of filtrados) {
      if (!isPago(p) || !p.data_pagamento) continue;
      const alvo = porSemana.get(chaveSemana(new Date(p.data_pagamento)));
      if (!alvo) continue;
      if (isReceber(p)) alvo.entradas += valorPago(p);
      else alvo.saidas += valorPago(p);
    }
    return [...porSemana.values()];
  }, [filtrados, dataInicio, dataFim]);

  const METODOS_ORDEM = METODO_OPTIONS.map((m) => m.label);
  const itensMetodo = Object.entries(porMetodo)
    .map(([metodo, total]) => ({ rotulo: METODO_LABEL[metodo] ?? metodo.replace("_", " ").replace(/^./, (c) => c.toUpperCase()), valor: total }))
    .sort((a, b) => b.valor - a.valor);

  const handleExportarCSV = () => {
    if (!filtrados.length) {
      warning("Nenhum dado para exportar.");
      return;
    }
    exportCsv(
      `relatorio_caixa_inadimplencia_${dataInicio}_${dataFim}.csv`,
      ["Tipo", "Status", "Cliente/Fornecedor", "Descrição", "Valor", "Valor pago", "Vencimento", "Pagamento", "Método"],
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
        title="Relatório de Caixa e Inadimplência"
        subtitle="Mostra o que entrou, o que ainda deve entrar, contas vencidas e pressão de caixa no período."
        onExport={handleExportarCSV}
      />

      <PeriodFilter dataInicio={dataInicio} dataFim={dataFim} onDataInicio={setDataInicio} onDataFim={setDataFim} />

      <StatGroup espalhar>
        <MetricCard label="Recebido" value={brl(recebido)} tone="success" />
        <MetricCard label="A receber" value={brl(aReceber)} tone="info" />
        <MetricCard label="Vencido" value={brl(valorVencido)} tone={valorVencido > 0 ? "error" : "default"} helper={`${vencidos.length} conta(s)`} />
        <MetricCard label="A pagar" value={brl(aPagar)} tone={aPagar > 0 ? "warning" : "default"} />
        <MetricCard label="Saldo projetado" value={brl(saldoProjetado)} tone={saldoProjetado < 0 ? "error" : "success"} helper={`Realizado: ${brl(saldoRealizado)}`} />
      </StatGroup>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: { xs: 3, lg: 6 }, mb: 4 }}>
        <Box>
          <TituloSecao>Entradas e saídas por semana</TituloSecao>
          <GraficoEntradasSaidas semanas={semanasChart} semDados="Nenhum recebimento ou pagamento realizado no período." />
        </Box>
        <Box>
          <TituloSecao>Recebido por forma de pagamento</TituloSecao>
          <GraficoPizza itens={itensMetodo} ordemCores={METODOS_ORDEM} semDados="Nenhum recebimento pago no período." />
        </Box>
      </Box>

      <TituloSecao>Movimentações</TituloSecao>
      <Box sx={{ overflowX: "auto" }}>
        {filtrados.length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Tipo</TableCell>
                <TableCell>Cliente/Fornecedor</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell align="center">Vencimento</TableCell>
                <TableCell align="center">Valor</TableCell>
                <TableCell align="center">Pagamento</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtrados.map((p) => {
                const vencido = isReceber(p) && isPendente(p) && p.data_vencimento && new Date(p.data_vencimento) < hoje;
                const status = vencido ? "Vencido" : p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : "-";
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>{isReceber(p) ? "Receber" : "Pagar"}</TableCell>
                    <TableCell>{p.cliente?.nome ?? p.fornecedor?.nome ?? "-"}</TableCell>
                    <TableCell>{p.descricao ?? p.categoria ?? "-"}</TableCell>
                    <TableCell align="center">{dateBr(p.data_vencimento)}</TableCell>
                    <TableCell align="center">{brl(Number(p.valor ?? 0))}</TableCell>
                    <TableCell align="center">{dateBr(p.data_pagamento)}</TableCell>
                    <TableCell align="center">{status}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : <EmptyReport message="Nenhum movimento financeiro encontrado no período." />}
      </Box>
    </ReportPage>
  );
}
