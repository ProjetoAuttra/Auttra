import * as React from "react";
import {
  Box,
  Chip,
  CircularProgress,
  MenuItem,
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
  StatGroup,
  ReportHeader,
  ReportPage, TituloSecao } from "../../shared/reportUtils";
import { GraficoBarrasHorizontais } from "../../shared/graficos";
import FiltrosRelatorio, { type CampoFiltro } from "../../shared/FiltrosRelatorio";

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
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const statusColor = (status?: string | null) => {
  if (status === "em_andamento") return "info" as const;
  if (status === "concluida") return "success" as const;
  if (status === "cancelada") return "error" as const;
  return "warning" as const;
};

type FiltrosOrdens = { situacao: string[]; mecanicos: string[]; clientes: string[] };
const PADRAO: FiltrosOrdens = { situacao: [], mecanicos: [], clientes: [] };
const SEM_MECANICO = "Sem mecânico";

export default function OrdensParadasRelatorio() {
  const { user } = useAuth();
  const { error, warning } = useToast();
  const [ordens, setOrdens] = React.useState<Ordem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [diasMinimos, setDiasMinimos] = React.useState("3");
  const [filtros, setFiltros] = React.useState(PADRAO);

  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/ordens", { params: { oficina_id: user?.oficina_id } });
        setOrdens(data ?? []);
      } catch (err) {
        console.error("Erro ao carregar ordens paradas:", err);
        error("Não foi possível carregar as ordens de serviço.");
      } finally {
        setLoading(false);
      }
    })();
  }, [error]);

  const emAberto = ordens.filter((o) => o.status !== "concluida" && o.status !== "cancelada");
  const abertas = emAberto.filter(
    (o) =>
      (!filtros.situacao.length || filtros.situacao.includes(o.status ?? "")) &&
      (!filtros.mecanicos.length || filtros.mecanicos.includes(o.funcionario?.nome ?? SEM_MECANICO)) &&
      (!filtros.clientes.length || filtros.clientes.includes(o.cliente?.nome ?? ""))
  );
  const unicos = (nomes: (string | null | undefined)[]) =>
    [...new Set(nomes.filter((n): n is string => !!n))].sort((a, b) => a.localeCompare(b, "pt-BR")).map((n) => ({ value: n, label: n }));
  const campos: CampoFiltro<FiltrosOrdens>[] = [
    { id: "situacao", label: "Situação", multi: true, vazio: "Todas as situações", opcoes: [{ value: "aberta", label: STATUS_LABEL.aberta }, { value: "em_andamento", label: STATUS_LABEL.em_andamento }] },
    { id: "mecanicos", label: "Mecânico", multi: true, opcoes: unicos(emAberto.map((o) => o.funcionario?.nome ?? SEM_MECANICO)) },
    { id: "clientes", label: "Cliente", multi: true, opcoes: unicos(emAberto.map((o) => o.cliente?.nome)) },
  ];
  const paradas = abertas
    .filter((o) => daysBetween(o.data_abertura) >= Number(diasMinimos))
    .sort((a, b) => daysBetween(b.data_abertura) - daysBetween(a.data_abertura));
  const valorPreso = abertas.reduce((sum, o) => sum + Number(o.valor_total ?? 0), 0);
  const valorParado = paradas.reduce((sum, o) => sum + Number(o.valor_total ?? 0), 0);
  const acima7Dias = abertas.filter((o) => daysBetween(o.data_abertura) >= 7).length;
  const maiorValorAberto = [...abertas].sort((a, b) => Number(b.valor_total ?? 0) - Number(a.valor_total ?? 0))[0];

  const porMecanico = paradas.reduce<Record<string, { qtd: number; valor: number }>>((acc, o) => {
    const nome = o.funcionario?.nome ?? "Sem mecânico";
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
      `relatorio_ordens_de_servico_${new Date().toISOString().slice(0, 10)}.csv`,
      ["OS", "Cliente", "Veículo", "Mecânico", "Situação", "Data abertura", "Dias aberta", "Valor"],
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
        title="Ordens de serviço"
        subtitle="Ordens abertas, há quantos dias estão paradas e quanto dinheiro está preso."
        onExport={handleExportarCSV}
      />

      <FiltrosRelatorio valores={filtros} onChange={setFiltros} padrao={PADRAO} campos={campos} periodo={false}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography variant="body2" fontWeight={600}>Considerar parada a partir de</Typography>
          <Select size="small" value={diasMinimos} onChange={(e: SelectChangeEvent) => setDiasMinimos(e.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="1">1 dia</MenuItem>
            <MenuItem value="3">3 dias</MenuItem>
            <MenuItem value="5">5 dias</MenuItem>
            <MenuItem value="7">7 dias</MenuItem>
          </Select>
        </Stack>
      </FiltrosRelatorio>

      <StatGroup espalhar>
        <MetricCard label="OS abertas" value={abertas.length} tone="info" />
        <MetricCard label="OS paradas" value={paradas.length} tone={paradas.length ? "warning" : "default"} helper={`${diasMinimos}+ dia(s)`} />
        <MetricCard label="Críticas" value={acima7Dias} tone={acima7Dias ? "error" : "default"} helper="7+ dias abertas" />
        <MetricCard label="Valor preso" value={brl(valorPreso)} tone={valorPreso > 0 ? "warning" : "default"} />
        <MetricCard label="Valor parado" value={brl(valorParado)} tone={valorParado > 0 ? "error" : "default"} />
      </StatGroup>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: { xs: 3, lg: 6 }, mb: 4 }}>
        <Box sx={{ flex: 1 }}>
          <TituloSecao>Prioridade por valor</TituloSecao>
          {maiorValorAberto ? (
            <Stack spacing={0.5}>
              <Typography variant="body2" fontWeight={600}>OS #{maiorValorAberto.id} - {maiorValorAberto.cliente?.nome ?? "Cliente não informado"}</Typography>
              <Typography variant="body2" color="text.secondary">{daysBetween(maiorValorAberto.data_abertura)} dia(s) aberta</Typography>
              <Typography fontWeight={700}>{brl(Number(maiorValorAberto.valor_total ?? 0))}</Typography>
            </Stack>
          ) : <Typography variant="body2" color="text.secondary">Nenhuma OS aberta.</Typography>}
        </Box>

        <Box sx={{ flex: 1 }}>
          <TituloSecao>Paradas por mecânico</TituloSecao>
          <GraficoBarrasHorizontais
            itens={Object.entries(porMecanico).map(([nome, item]) => ({ rotulo: `${nome} (${item.qtd})`, valor: item.valor })).sort((a, b) => b.valor - a.valor)}
            semDados="Nenhuma OS parada nesse critério."
          />
        </Box>
      </Box>

      <TituloSecao>OS paradas</TituloSecao>
      <Box sx={{ overflowX: "auto" }}>
        {paradas.length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>OS</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Veículo</TableCell>
                <TableCell>Mecânico</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell>Abertura</TableCell>
                <TableCell align="right">Dias</TableCell>
                <TableCell align="right">Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paradas.map((o) => (
                <TableRow key={o.id} hover>
                  <TableCell sx={{ fontWeight: 700 }}>#{o.id}</TableCell>
                  <TableCell>{o.cliente?.nome ?? "-"}</TableCell>
                  <TableCell>{[o.veiculo?.marca, o.veiculo?.modelo, o.veiculo?.placa].filter(Boolean).join(" ") || "-"}</TableCell>
                  <TableCell>{o.funcionario?.nome ?? "-"}</TableCell>
                  <TableCell><Chip size="small" label={STATUS_LABEL[o.status ?? ""] ?? o.status ?? "-"} color={statusColor(o.status)} sx={{ fontWeight: 700 }} /></TableCell>
                  <TableCell>{dateBr(o.data_abertura)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{daysBetween(o.data_abertura)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{brl(Number(o.valor_total ?? 0))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <EmptyReport message="Nenhuma OS parada no critério selecionado." />}
      </Box>
    </ReportPage>
  );
}
