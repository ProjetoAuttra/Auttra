import * as React from "react";
import {
  Box,
  Chip,
  CircularProgress,
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
  daysBetween,
  EmptyReport,
  exportCsv,
  periodoMesAtual,
  inDateRange,
  MetricCard,
  StatGroup,
  percent,
  ReportHeader,
  ReportPage,
  TituloSecao } from "../../shared/reportUtils";
import { GraficoBarrasHorizontais } from "../../shared/graficos";
import FiltrosRelatorio, { type CampoFiltro } from "../../shared/FiltrosRelatorio";

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
  analise: "Em análise",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

const statusColor = (status: string) => {
  if (status === "aprovado") return "success" as const;
  if (status === "recusado") return "error" as const;
  return "warning" as const;
};

type FiltrosOrcamentos = { de: string; ate: string; situacao: string[]; clientes: string[] };
const PADRAO: FiltrosOrcamentos = { ...periodoMesAtual(), situacao: [], clientes: [] };

export default function OrcamentosPerdidosRelatorio() {
  const { user } = useAuth();
  const { error, warning } = useToast();
  const [orcamentos, setOrcamentos] = React.useState<Orcamento[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filtros, setFiltros] = React.useState(PADRAO);
  const { de: dataInicio, ate: dataFim } = filtros;

  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/orcamentos", { params: { oficina_id: user?.oficina_id } });
        setOrcamentos(data ?? []);
      } catch (err) {
        console.error("Erro ao carregar orçamentos perdidos:", err);
        error("Não foi possível carregar os orçamentos.");
      } finally {
        setLoading(false);
      }
    })();
  }, [error]);

  const noPeriodo = orcamentos.filter(
    (o) => inDateRange(o.data, dataInicio, dataFim) && (!filtros.clientes.length || filtros.clientes.includes(o.cliente?.nome ?? ""))
  );
  const clientesOpcoes = [...new Set(orcamentos.map((o) => o.cliente?.nome).filter((n): n is string => !!n))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((n) => ({ value: n, label: n }));
  const campos: CampoFiltro<FiltrosOrcamentos>[] = [
    {
      id: "situacao",
      label: "Situação",
      multi: true,
      vazio: "Todas as situações",
      opcoes: [{ value: "analise", label: "Em análise" }, { value: "aprovado", label: "Aprovados" }, { value: "recusado", label: "Recusados" }],
    },
    { id: "clientes", label: "Cliente", multi: true, opcoes: clientesOpcoes },
  ];
  const perdidos = noPeriodo.filter((o) => o.status === "recusado");
  const pendentes = noPeriodo.filter((o) => o.status === "analise");
  const aprovados = noPeriodo.filter((o) => o.status === "aprovado");
  const potencialTotal = noPeriodo.reduce((sum, o) => sum + Number(o.valor ?? 0), 0);
  const valorPerdido = perdidos.reduce((sum, o) => sum + Number(o.valor ?? 0), 0);
  const valorPendente = pendentes.reduce((sum, o) => sum + Number(o.valor ?? 0), 0);
  const taxaConversao = noPeriodo.length ? (aprovados.length / noPeriodo.length) * 100 : 0;

  const linhas = noPeriodo
    .filter((o) => !filtros.situacao.length || filtros.situacao.includes(o.status))
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
      warning("Nenhum orçamento para exportar.");
      return;
    }
    exportCsv(
      `relatorio_orcamentos_perdidos_${dataInicio}_${dataFim}.csv`,
      ["Orçamento", "Cliente", "Telefone", "Veículo", "Situação", "Data", "Dias sem resposta", "Valor", "Descrição"],
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
        title="Conversão de orçamentos"
        subtitle="Quantos orçamentos viram serviço, quanto foi perdido e o que ainda dá para recuperar."
        onExport={handleExportarCSV}
      />

      <FiltrosRelatorio valores={filtros} onChange={setFiltros} padrao={PADRAO} campos={campos} />

      <StatGroup espalhar>
        <MetricCard label="Orçamentos" value={noPeriodo.length} />
        <MetricCard label="Valor perdido" value={brl(valorPerdido)} tone={valorPerdido ? "error" : "default"} />
        <MetricCard label="Pendente para recuperar" value={brl(valorPendente)} tone={valorPendente ? "warning" : "default"} />
        <MetricCard label="Conversão" value={percent(taxaConversao)} tone={taxaConversao >= 50 ? "success" : "warning"} helper={`${aprovados.length} aprovado(s)`} />
        <MetricCard label="Potencial total" value={brl(potencialTotal)} tone="info" />
      </StatGroup>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: { xs: 3, lg: 6 }, mb: 4 }}>
        <Box sx={{ flex: 1 }}>
          <TituloSecao>Principais perdas por item</TituloSecao>
          <GraficoBarrasHorizontais
            itens={Object.entries(servicosPerdidos).map(([nome, item]) => ({ rotulo: `${nome} (${item.qtd})`, valor: item.valor })).sort((a, b) => b.valor - a.valor).slice(0, 8)}
            semDados="Nenhum orçamento perdido no período."
          />
        </Box>

        <Box sx={{ flex: 1 }}>
          <TituloSecao>Follow-up prioritário</TituloSecao>
          {pendentes.length ? [...pendentes]
            .sort((a, b) => daysBetween(b.data) - daysBetween(a.data) || Number(b.valor ?? 0) - Number(a.valor ?? 0))
            .slice(0, 8)
            .map((o) => (
              <Stack key={o.id} direction="row" justifyContent="space-between" gap={2} py={0.75}>
                <Stack minWidth={0}>
                  <Typography variant="body2" fontWeight={600} noWrap>{o.cliente?.nome ?? "Cliente não informado"}</Typography>
                  <Typography variant="caption" color="text.secondary">{daysBetween(o.data)} dia(s) em analise</Typography>
                </Stack>
                <Typography variant="body2" fontWeight={600}>{brl(Number(o.valor ?? 0))}</Typography>
              </Stack>
            )) : <Typography variant="body2" color="text.secondary">Nenhum orçamento pendente no período.</Typography>}
        </Box>
      </Box>

      <TituloSecao>Orçamentos</TituloSecao>
      <Box sx={{ overflowX: "auto" }}>
        {linhas.length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Orçamento</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Telefone</TableCell>
                <TableCell>Veículo</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell>Data</TableCell>
                <TableCell align="right">Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {linhas.map((o) => (
                <TableRow key={o.id} hover>
                  <TableCell sx={{ fontWeight: 700 }}>#{o.id}</TableCell>
                  <TableCell>{o.cliente?.nome ?? "-"}</TableCell>
                  <TableCell>{o.cliente?.telefone ?? "-"}</TableCell>
                  <TableCell>{[o.veiculo?.modelo, o.veiculo?.placa].filter(Boolean).join(" ") || "-"}</TableCell>
                  <TableCell><Chip size="small" label={statusLabel[o.status] ?? o.status} color={statusColor(o.status)} sx={{ fontWeight: 700 }} /></TableCell>
                  <TableCell>{dateBr(o.data)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{brl(Number(o.valor ?? 0))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <EmptyReport message="Nenhum orçamento encontrado nesse filtro." />}
      </Box>
    </ReportPage>
  );
}
