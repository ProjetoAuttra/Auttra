import * as React from "react";
import { Box, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { EmptyReport, MetricCard, ReportHeader, ReportPage, StatGroup, TituloSecao, brl, exportCsv, periodoMesAtual, percent } from "../../shared/reportUtils";
import { GraficoBarrasHorizontais } from "../../shared/graficos";
import { useRelatorio } from "../../shared/useRelatorio";
import FiltrosRelatorio from "../../shared/FiltrosRelatorio";

type Mecanico = {
  id: number;
  nome: string;
  ordens_concluidas: number;
  ordens_abertas: number;
  faturamento: number;
  ticket_medio: number;
  custo_pecas: number;
  margem: number;
  margem_percentual: number;
};
type Dados = { totais: { ordens_concluidas: number; faturamento: number; ticket_medio: number }; mecanicos: Mecanico[] };

const PADRAO = periodoMesAtual();

export default function MecanicosRelatorio() {
  const [filtros, setFiltros] = React.useState(PADRAO);
  const { de: dataInicio, ate: dataFim } = filtros;
  const { dados, carregando } = useRelatorio<Dados>("/relatorios/mecanicos", { from: dataInicio, to: dataFim });

  const exportar = () => {
    if (!dados?.mecanicos.length) return;
    exportCsv(
      `relatorio_desempenho_mecanicos_${dataInicio}_${dataFim}.csv`,
      ["Mecânico", "OS concluídas", "OS abertas", "Faturamento", "Ticket médio", "Custo de peças", "Margem", "Margem %"],
      dados.mecanicos.map((m) => [
        m.nome,
        m.ordens_concluidas,
        m.ordens_abertas,
        m.faturamento.toFixed(2).replace(".", ","),
        m.ticket_medio.toFixed(2).replace(".", ","),
        m.custo_pecas.toFixed(2).replace(".", ","),
        m.margem.toFixed(2).replace(".", ","),
        m.margem_percentual.toFixed(1).replace(".", ","),
      ])
    );
  };

  return (
    <ReportPage>
      <ReportHeader title="Desempenho por mecânico" subtitle="Ordens concluídas, faturamento, ticket médio e margem de cada mecânico no período." onExport={exportar} />
      <FiltrosRelatorio valores={filtros} onChange={setFiltros} padrao={PADRAO} />

      {carregando && !dados ? (
        <Box sx={{ textAlign: "center", mt: 6 }}><CircularProgress /></Box>
      ) : !dados ? (
        <EmptyReport message="Não foi possível carregar o relatório." />
      ) : (
        <>
          <StatGroup espalhar>
            <MetricCard label="OS concluídas" value={dados.totais.ordens_concluidas} />
            <MetricCard label="Faturamento" value={brl(dados.totais.faturamento)} />
            <MetricCard label="Ticket médio" value={brl(dados.totais.ticket_medio)} />
          </StatGroup>

          <Box sx={{ mb: 4 }}>
            <TituloSecao>Faturamento por mecânico</TituloSecao>
            <GraficoBarrasHorizontais
              itens={dados.mecanicos.map((m) => ({ rotulo: `${m.nome} (${m.ordens_concluidas})`, valor: m.faturamento }))}
              semDados="Nenhuma OS concluída no período."
              larguraRotulo={170}
            />
          </Box>

          <TituloSecao>Detalhamento</TituloSecao>
          <Box sx={{ overflowX: "auto" }}>
            {dados.mecanicos.length ? (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Mecânico</TableCell>
                    <TableCell align="center">OS concluídas</TableCell>
                    <TableCell align="center">OS abertas</TableCell>
                    <TableCell align="center">Faturamento</TableCell>
                    <TableCell align="center">Ticket médio</TableCell>
                    <TableCell align="center">Custo de peças</TableCell>
                    <TableCell align="center">Margem</TableCell>
                    <TableCell align="center">Margem %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dados.mecanicos.map((m) => (
                    <TableRow key={m.id} hover>
                      <TableCell>{m.nome}</TableCell>
                      <TableCell align="center">{m.ordens_concluidas}</TableCell>
                      <TableCell align="center">{m.ordens_abertas}</TableCell>
                      <TableCell align="center">{brl(m.faturamento)}</TableCell>
                      <TableCell align="center">{brl(m.ticket_medio)}</TableCell>
                      <TableCell align="center">{brl(m.custo_pecas)}</TableCell>
                      <TableCell align="center">{brl(m.margem)}</TableCell>
                      <TableCell align="center">{percent(m.margem_percentual)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <EmptyReport message="Nenhum mecânico com ordens no período." />}
          </Box>
        </>
      )}
    </ReportPage>
  );
}
