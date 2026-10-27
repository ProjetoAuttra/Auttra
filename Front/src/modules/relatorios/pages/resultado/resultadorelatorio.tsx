import * as React from "react";
import { Box, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { EmptyReport, MetricCard, PeriodFilter, ReportHeader, ReportPage, StatGroup, TituloSecao, brl, exportCsv, firstDayOfMonthISO, percent, todayISO } from "../../shared/reportUtils";
import { GraficoBarrasHorizontais, GraficoPizza } from "../../shared/graficos";
import { useRelatorio } from "../../shared/useRelatorio";

type Categoria = { categoria: string; valor: number };
type Resultado = {
  receitas: number;
  despesas: number;
  resultado: number;
  margem_percentual: number;
  periodo_anterior: { receitas: number; despesas: number; resultado: number };
  variacao_resultado: number | null;
  receitas_por_categoria: Categoria[];
  despesas_por_categoria: Categoria[];
};

const variacaoTexto = (v: number | null) => (v === null ? "" : `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs. anterior`);

export default function ResultadoRelatorio() {
  const [dataInicio, setDataInicio] = React.useState(firstDayOfMonthISO());
  const [dataFim, setDataFim] = React.useState(todayISO());
  const { dados, carregando } = useRelatorio<Resultado>("/relatorios/resultado", { from: dataInicio, to: dataFim });

  const linhas = React.useMemo(() => {
    if (!dados) return [];
    return [
      { nivel: 0, nome: "Receitas", valor: dados.receitas },
      ...dados.receitas_por_categoria.map((c) => ({ nivel: 1, nome: c.categoria, valor: c.valor })),
      { nivel: 0, nome: "Despesas", valor: -dados.despesas },
      ...dados.despesas_por_categoria.map((c) => ({ nivel: 1, nome: c.categoria, valor: -c.valor })),
      { nivel: 0, nome: "Resultado do período", valor: dados.resultado },
    ];
  }, [dados]);

  const exportar = () => {
    if (!linhas.length) return;
    exportCsv(`relatorio_resultado_${dataInicio}_${dataFim}.csv`, ["Conta", "Valor"], linhas.map((l) => [`${l.nivel ? "  " : ""}${l.nome}`, l.valor.toFixed(2).replace(".", ",")]));
  };

  return (
    <ReportPage>
      <ReportHeader title="Resultado do mês" subtitle="Receitas, despesas e resultado do período, pelo que entrou e saiu de fato no caixa." onExport={exportar} />
      <PeriodFilter dataInicio={dataInicio} dataFim={dataFim} onDataInicio={setDataInicio} onDataFim={setDataFim} />

      {carregando && !dados ? (
        <Box sx={{ textAlign: "center", mt: 6 }}><CircularProgress /></Box>
      ) : !dados ? (
        <EmptyReport message="Não foi possível carregar o relatório." />
      ) : (
        <>
          <StatGroup espalhar>
            <MetricCard label="Receitas" value={brl(dados.receitas)} helper={`Anterior: ${brl(dados.periodo_anterior.receitas)}`} />
            <MetricCard label="Despesas" value={brl(dados.despesas)} helper={`Anterior: ${brl(dados.periodo_anterior.despesas)}`} />
            <MetricCard label="Resultado" value={brl(dados.resultado)} helper={variacaoTexto(dados.variacao_resultado) || `Anterior: ${brl(dados.periodo_anterior.resultado)}`} />
            <MetricCard label="Margem" value={percent(dados.margem_percentual)} helper="Resultado sobre receitas" />
          </StatGroup>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: { xs: 3, lg: 6 }, mb: 4 }}>
            <Box>
              <TituloSecao>Receitas por categoria</TituloSecao>
              <GraficoPizza
                itens={dados.receitas_por_categoria.map((c) => ({ rotulo: c.categoria, valor: c.valor }))}
                ordemCores={dados.receitas_por_categoria.map((c) => c.categoria)}
                semDados="Nenhuma receita no período."
              />
            </Box>
            <Box>
              <TituloSecao>Despesas por categoria</TituloSecao>
              <GraficoBarrasHorizontais
                itens={dados.despesas_por_categoria.map((c) => ({ rotulo: c.categoria, valor: c.valor }))}
                semDados="Nenhuma despesa no período."
              />
            </Box>
          </Box>

          <TituloSecao>Demonstrativo</TituloSecao>
          <Box sx={{ overflowX: "auto" }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Conta</TableCell>
                  <TableCell align="right">Valor</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {linhas.map((l, i) => (
                  <TableRow key={`${l.nome}-${i}`} hover>
                    <TableCell sx={{ pl: l.nivel ? 5 : 2, fontWeight: l.nivel ? 400 : 700 }}>{l.nome}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: l.nivel ? 400 : 700 }}>{brl(l.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </>
      )}
    </ReportPage>
  );
}
