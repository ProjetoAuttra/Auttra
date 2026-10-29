import { Box, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { EmptyReport, MetricCard, ReportHeader, ReportPage, StatGroup, TituloSecao, brl, exportCsv, percent } from "../../shared/reportUtils";
import { GraficoBarrasHorizontais } from "../../shared/graficos";
import { useRelatorio } from "../../shared/useRelatorio";
import FiltrosRelatorio, { type CampoFiltro } from "../../shared/FiltrosRelatorio";
import { useOpcoesRelatorio } from "../../shared/useOpcoesRelatorio";
import * as React from "react";

type Inadimplencia = {
  total_vencido: number;
  titulos_vencidos: number;
  clientes_inadimplentes: number;
  total_a_receber: number;
  percentual_carteira: number;
  faixas: Array<{ faixa: string; quantidade: number; valor: number }>;
  clientes: Array<{ cliente_id: number | null; nome: string; titulos: number; valor: number; dias_atraso: number }>;
};

const ROTULO_FAIXA: Record<string, string> = { "1-30": "1 a 30 dias", "31-60": "31 a 60 dias", "61-90": "61 a 90 dias", "90+": "Mais de 90 dias" };

type FiltrosInadimplencia = { clientes: string[] };
const PADRAO: FiltrosInadimplencia = { clientes: [] };

export default function InadimplenciaRelatorio() {
  const [filtros, setFiltros] = React.useState(PADRAO);
  const opcoes = useOpcoesRelatorio({ clientes: true });
  const campos: CampoFiltro<FiltrosInadimplencia>[] = [{ id: "clientes", label: "Cliente", multi: true, opcoes: opcoes.clientes }];
  const { dados, carregando } = useRelatorio<Inadimplencia>("/relatorios/inadimplencia", { cliente_id: filtros.clientes.join(",") });

  const exportar = () => {
    if (!dados?.clientes.length) return;
    exportCsv(
      `relatorio_inadimplencia_${new Date().toISOString().slice(0, 10)}.csv`,
      ["Cliente", "Títulos vencidos", "Maior atraso (dias)", "Valor em aberto"],
      dados.clientes.map((c) => [c.nome, c.titulos, c.dias_atraso, c.valor.toFixed(2).replace(".", ",")])
    );
  };

  if (carregando && !dados) return <Box sx={{ textAlign: "center", mt: 6 }}><CircularProgress /></Box>;
  if (!dados) return <EmptyReport message="Não foi possível carregar o relatório." />;

  return (
    <ReportPage>
      <ReportHeader title="Inadimplência" subtitle="Contas a receber vencidas, há quanto tempo e quem deve." onExport={exportar} />
      <FiltrosRelatorio valores={filtros} onChange={setFiltros} padrao={PADRAO} campos={campos} periodo={false} />

      <StatGroup espalhar>
        <MetricCard label="Total vencido" value={brl(dados.total_vencido)} />
        <MetricCard label="Títulos vencidos" value={dados.titulos_vencidos} />
        <MetricCard label="Clientes inadimplentes" value={dados.clientes_inadimplentes} />
        <MetricCard label="Do total a receber" value={percent(dados.percentual_carteira)} helper={`Carteira: ${brl(dados.total_a_receber)}`} />
      </StatGroup>

      <Box sx={{ mb: 4 }}>
        <TituloSecao>Valor vencido por faixa de atraso</TituloSecao>
        <GraficoBarrasHorizontais
          itens={dados.faixas.map((f) => ({ rotulo: `${ROTULO_FAIXA[f.faixa] ?? f.faixa} (${f.quantidade})`, valor: f.valor }))}
          semDados="Nenhuma conta vencida."
          larguraRotulo={170}
          ordenar={false}
        />
      </Box>

      <TituloSecao>Quem está devendo</TituloSecao>
      <Box sx={{ overflowX: "auto" }}>
        {dados.clientes.length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Cliente</TableCell>
                <TableCell align="center">Títulos vencidos</TableCell>
                <TableCell align="center">Maior atraso</TableCell>
                <TableCell align="center">Valor em aberto</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dados.clientes.map((c) => (
                <TableRow key={c.cliente_id ?? c.nome} hover>
                  <TableCell>{c.nome}</TableCell>
                  <TableCell align="center">{c.titulos}</TableCell>
                  <TableCell align="center">{c.dias_atraso} dia(s)</TableCell>
                  <TableCell align="center">{brl(c.valor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <EmptyReport message="Nenhum cliente com contas vencidas." />}
      </Box>
    </ReportPage>
  );
}
