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
  percent,
  PeriodFilter,
  ReportHeader,
  ReportPage,
  todayISO,
} from "../../shared/reportUtils";

type ItemOrdem = {
  tipo_item?: "servico" | "peca" | string | null;
  quantidade?: number | null;
  preco_unitario?: number | string | null;
  subtotal?: number | string | null;
  peca?: { nome?: string | null; preco_custo?: number | string | null } | null;
  servico?: { nome?: string | null } | null;
};

type Ordem = {
  id: number;
  status?: string | null;
  data_abertura?: string | null;
  data_fechamento?: string | null;
  valor_total?: number | string | null;
  cliente?: { nome?: string | null } | null;
  veiculo?: { modelo?: string | null; placa?: string | null } | null;
  funcionario?: { nome?: string | null } | null;
  itens?: ItemOrdem[];
};

const custoPecas = (ordem: Ordem) =>
  (ordem.itens ?? [])
    .filter((item) => item.tipo_item === "peca")
    .reduce((sum, item) => sum + Number(item.quantidade ?? 1) * Number(item.peca?.preco_custo ?? 0), 0);

const receita = (ordem: Ordem) => Number(ordem.valor_total ?? 0);
const lucro = (ordem: Ordem) => receita(ordem) - custoPecas(ordem);
const margem = (ordem: Ordem) => receita(ordem) ? (lucro(ordem) / receita(ordem)) * 100 : 0;
const dataConclusao = (ordem: Ordem) => ordem.data_fechamento ?? ordem.data_abertura;

export default function RentabilidadeRelatorio() {
  const { user } = useAuth();
  const { error, warning } = useToast();
  const [ordens, setOrdens] = React.useState<Ordem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dataInicio, setDataInicio] = React.useState(firstDayOfMonthISO());
  const [dataFim, setDataFim] = React.useState(todayISO());

  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/ordens", { params: { oficina_id: user?.oficina_id } });
        setOrdens(data ?? []);
      } catch (err) {
        console.error("Erro ao carregar rentabilidade:", err);
        error("Nao foi possivel carregar a rentabilidade por OS.");
      } finally {
        setLoading(false);
      }
    })();
  }, [error]);

  const concluidas = ordens
    .filter((o) => o.status === "concluida" && inDateRange(dataConclusao(o), dataInicio, dataFim))
    .sort((a, b) => margem(a) - margem(b));

  const faturamento = concluidas.reduce((sum, o) => sum + receita(o), 0);
  const custoTotal = concluidas.reduce((sum, o) => sum + custoPecas(o), 0);
  const lucroTotal = faturamento - custoTotal;
  const margemMedia = faturamento ? (lucroTotal / faturamento) * 100 : 0;
  const ticketMedio = concluidas.length ? faturamento / concluidas.length : 0;
  const margemBaixa = concluidas.filter((o) => margem(o) < 30);

  const porCliente = concluidas.reduce<Record<string, { qtd: number; receita: number; lucro: number }>>((acc, o) => {
    const nome = o.cliente?.nome ?? "Cliente nao informado";
    acc[nome] = acc[nome] ?? { qtd: 0, receita: 0, lucro: 0 };
    acc[nome].qtd += 1;
    acc[nome].receita += receita(o);
    acc[nome].lucro += lucro(o);
    return acc;
  }, {});

  const porMecanico = concluidas.reduce<Record<string, { qtd: number; receita: number; lucro: number }>>((acc, o) => {
    const nome = o.funcionario?.nome ?? "Sem mecanico";
    acc[nome] = acc[nome] ?? { qtd: 0, receita: 0, lucro: 0 };
    acc[nome].qtd += 1;
    acc[nome].receita += receita(o);
    acc[nome].lucro += lucro(o);
    return acc;
  }, {});

  const handleExportarCSV = () => {
    if (!concluidas.length) {
      warning("Nenhuma OS concluida para exportar.");
      return;
    }
    exportCsv(
      `relatorio_rentabilidade_os_${dataInicio}_${dataFim}.csv`,
      ["OS", "Cliente", "Veiculo", "Mecanico", "Data", "Receita", "Custo pecas", "Lucro bruto", "Margem"],
      concluidas.map((o) => [
        `#${o.id}`,
        o.cliente?.nome ?? "",
        [o.veiculo?.modelo, o.veiculo?.placa].filter(Boolean).join(" "),
        o.funcionario?.nome ?? "",
        dateBr(dataConclusao(o)),
        receita(o).toFixed(2).replace(".", ","),
        custoPecas(o).toFixed(2).replace(".", ","),
        lucro(o).toFixed(2).replace(".", ","),
        `${margem(o).toFixed(1).replace(".", ",")}%`,
      ])
    );
  };

  if (loading) return <Box sx={{ textAlign: "center", mt: 6 }}><CircularProgress /></Box>;

  return (
    <ReportPage>
      <ReportHeader
        title="Relatorio de Rentabilidade por OS"
        subtitle="Mostra quais ordens deram mais lucro bruto e quais precisam de revisao de preco."
        onExport={handleExportarCSV}
      />

      <PeriodFilter dataInicio={dataInicio} dataFim={dataFim} onDataInicio={setDataInicio} onDataFim={setDataFim} />

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} mb={2.5}>
        <MetricCard label="OS concluidas" value={concluidas.length} />
        <MetricCard label="Faturamento" value={brl(faturamento)} tone="info" />
        <MetricCard label="Custo pecas" value={brl(custoTotal)} tone="warning" />
        <MetricCard label="Lucro bruto estimado" value={brl(lucroTotal)} tone={lucroTotal >= 0 ? "success" : "error"} />
        <MetricCard label="Margem media" value={percent(margemMedia)} tone={margemMedia >= 30 ? "success" : "warning"} helper={`Ticket: ${brl(ticketMedio)}`} />
      </Stack>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={2.5} mb={2.5}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1 }}>
          <Typography fontWeight={800} mb={1}>Clientes mais rentaveis</Typography>
          {Object.entries(porCliente).length ? Object.entries(porCliente)
            .sort((a, b) => b[1].lucro - a[1].lucro)
            .slice(0, 8)
            .map(([nome, item]) => (
              <Stack key={nome} direction="row" justifyContent="space-between" gap={2} py={0.75}>
                <Typography variant="body2" noWrap>{nome}</Typography>
                <Typography variant="body2" fontWeight={800}>{item.qtd} OS - {brl(item.lucro)}</Typography>
              </Stack>
            )) : <Typography variant="body2" color="text.secondary">Nenhuma OS concluida no periodo.</Typography>}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1 }}>
          <Typography fontWeight={800} mb={1}>Rentabilidade por mecanico</Typography>
          {Object.entries(porMecanico).length ? Object.entries(porMecanico)
            .sort((a, b) => b[1].lucro - a[1].lucro)
            .slice(0, 8)
            .map(([nome, item]) => (
              <Stack key={nome} direction="row" justifyContent="space-between" gap={2} py={0.75}>
                <Typography variant="body2" noWrap>{nome}</Typography>
                <Typography variant="body2" fontWeight={800}>{item.qtd} OS - {brl(item.lucro)}</Typography>
              </Stack>
            )) : <Typography variant="body2" color="text.secondary">Nenhuma OS concluida no periodo.</Typography>}
        </Paper>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2 }}>
        <Typography fontWeight={800} mb={1}>OS que pedem revisao de preco</Typography>
        {margemBaixa.length ? (
          <Stack direction="row" gap={1} flexWrap="wrap">
            {margemBaixa.slice(0, 12).map((o) => (
              <Chip key={o.id} label={`#${o.id} - ${percent(margem(o))}`} color="warning" sx={{ fontWeight: 700 }} />
            ))}
          </Stack>
        ) : <Typography variant="body2" color="text.secondary">Nenhuma OS concluida com margem abaixo de 30%.</Typography>}
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: "auto" }}>
        {concluidas.length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>OS</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Veiculo</TableCell>
                <TableCell>Mecanico</TableCell>
                <TableCell>Data</TableCell>
                <TableCell align="right">Receita</TableCell>
                <TableCell align="right">Custo pecas</TableCell>
                <TableCell align="right">Lucro bruto</TableCell>
                <TableCell align="right">Margem</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {concluidas.map((o) => {
                const m = margem(o);
                return (
                  <TableRow key={o.id} hover>
                    <TableCell sx={{ fontWeight: 800 }}>#{o.id}</TableCell>
                    <TableCell>{o.cliente?.nome ?? "-"}</TableCell>
                    <TableCell>{[o.veiculo?.modelo, o.veiculo?.placa].filter(Boolean).join(" ") || "-"}</TableCell>
                    <TableCell>{o.funcionario?.nome ?? "-"}</TableCell>
                    <TableCell>{dateBr(dataConclusao(o))}</TableCell>
                    <TableCell align="right">{brl(receita(o))}</TableCell>
                    <TableCell align="right">{brl(custoPecas(o))}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>{brl(lucro(o))}</TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={percent(m)} color={m < 30 ? "warning" : "success"} sx={{ fontWeight: 700 }} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : <EmptyReport message="Nenhuma OS concluida no periodo." />}
      </Paper>
    </ReportPage>
  );
}
