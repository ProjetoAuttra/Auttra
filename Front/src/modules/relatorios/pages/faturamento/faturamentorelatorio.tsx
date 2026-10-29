import * as React from "react";
import { Box, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { EmptyReport, MetricCard, ReportHeader, ReportPage, StatGroup, TituloSecao, brl, exportCsv, periodoMesAtual } from "../../shared/reportUtils";
import { GraficoBarrasHorizontais, GraficoColunas, GraficoPizza, chaveSemana, rotuloSemana, semanasDoPeriodo } from "../../shared/graficos";
import { useRelatorio } from "../../shared/useRelatorio";
import FiltrosRelatorio, { type CampoFiltro } from "../../shared/FiltrosRelatorio";
import { useOpcoesRelatorio } from "../../shared/useOpcoesRelatorio";

type Faturamento = {
  periodo: { de: string; ate: string };
  total: number;
  ordens_concluidas: number;
  ticket_medio: number;
  periodo_anterior: { total: number; ordens_concluidas: number };
  variacao_percentual: number | null;
  semanas: Array<{ semana: string; total: number; ordens: number }>;
  composicao: { servicos: number; pecas: number };
  clientes: Array<{ nome: string; total: number; ordens: number }>;
};

export const textoVariacao = (v: number | null) =>
  v === null ? "—" : `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

type FiltrosFaturamento = { de: string; ate: string; mecanicos: string[]; clientes: string[] };
const PADRAO: FiltrosFaturamento = { ...periodoMesAtual(), mecanicos: [], clientes: [] };

export default function FaturamentoRelatorio() {
  const [filtros, setFiltros] = React.useState<FiltrosFaturamento>(PADRAO);
  const { de: dataInicio, ate: dataFim } = filtros;
  const opcoes = useOpcoesRelatorio({ mecanicos: true, clientes: true });
  const campos: CampoFiltro<FiltrosFaturamento>[] = [
    { id: "mecanicos", label: "Mecânico", multi: true, opcoes: opcoes.mecanicos },
    { id: "clientes", label: "Cliente", multi: true, opcoes: opcoes.clientes },
  ];
  const { dados, carregando } = useRelatorio<Faturamento>("/relatorios/faturamento", {
    from: dataInicio,
    to: dataFim,
    mecanico_id: filtros.mecanicos.join(","),
    cliente_id: filtros.clientes.join(","),
  });

  const semanas = React.useMemo(() => {
    if (!dados) return [];
    const porSemana = new Map(dados.semanas.map((s) => [s.semana, s.total]));
    return semanasDoPeriodo(dataInicio, dataFim).map((d) => ({ rotulo: rotuloSemana(d), valor: porSemana.get(chaveSemana(d)) ?? 0 }));
  }, [dados, dataInicio, dataFim]);

  const exportar = () => {
    if (!dados?.semanas.length) return;
    exportCsv(
      `relatorio_faturamento_${dataInicio}_${dataFim}.csv`,
      ["Semana (início)", "OS concluídas", "Faturamento"],
      dados.semanas.map((s) => [s.semana, s.ordens, s.total.toFixed(2).replace(".", ",")])
    );
  };

  return (
    <ReportPage>
      <ReportHeader title="Faturamento" subtitle="Valor das ordens de serviço concluídas no período, comparado com o período anterior." onExport={exportar} />
      <FiltrosRelatorio valores={filtros} onChange={setFiltros} padrao={PADRAO} campos={campos} />

      {carregando && !dados ? (
        <Box sx={{ textAlign: "center", mt: 6 }}><CircularProgress /></Box>
      ) : !dados ? (
        <EmptyReport message="Não foi possível carregar o relatório." />
      ) : (
        <>
          <StatGroup espalhar>
            <MetricCard label="Faturamento" value={brl(dados.total)} />
            <MetricCard label="OS concluídas" value={dados.ordens_concluidas} />
            <MetricCard label="Ticket médio" value={brl(dados.ticket_medio)} />
            <MetricCard label="Vs. período anterior" value={textoVariacao(dados.variacao_percentual)} helper={`Anterior: ${brl(dados.periodo_anterior.total)}`} />
          </StatGroup>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: { xs: 3, lg: 6 }, mb: 4 }}>
            <Box>
              <TituloSecao>Faturamento por semana</TituloSecao>
              <GraficoColunas itens={semanas} serie="Faturamento" semDados="Nenhuma OS concluída no período." />
            </Box>
            <Box>
              <TituloSecao>Serviços e peças</TituloSecao>
              <GraficoPizza
                itens={[
                  { rotulo: "Serviços", valor: dados.composicao.servicos },
                  { rotulo: "Peças", valor: dados.composicao.pecas },
                ].filter((i) => i.valor > 0)}
                ordemCores={["Serviços", "Peças"]}
                semDados="Nenhuma OS concluída no período."
              />
            </Box>
          </Box>

          <Box sx={{ mb: 4 }}>
            <TituloSecao>Maiores clientes do período</TituloSecao>
            <GraficoBarrasHorizontais
              itens={dados.clientes.map((c) => ({ rotulo: `${c.nome} (${c.ordens})`, valor: c.total }))}
              semDados="Nenhuma OS concluída no período."
              larguraRotulo={170}
            />
          </Box>

          <TituloSecao>Faturamento semanal</TituloSecao>
          <Box sx={{ overflowX: "auto" }}>
            {dados.semanas.length ? (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Semana (início)</TableCell>
                    <TableCell align="center">OS concluídas</TableCell>
                    <TableCell align="center">Faturamento</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dados.semanas.map((s) => (
                    <TableRow key={s.semana} hover>
                      <TableCell>{s.semana.split("-").reverse().join("/")}</TableCell>
                      <TableCell align="center">{s.ordens}</TableCell>
                      <TableCell align="center">{brl(s.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <EmptyReport message="Nenhuma OS concluída no período." />}
          </Box>
        </>
      )}
    </ReportPage>
  );
}
