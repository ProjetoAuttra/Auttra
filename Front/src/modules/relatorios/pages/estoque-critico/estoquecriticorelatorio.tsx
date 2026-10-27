import * as React from "react";
import {
  Box,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../context/ToastContext";
import {
  brl,
  EmptyReport,
  exportCsv,
  LIMITE_ESTOQUE_BAIXO,
  MetricCard,
  StatGroup,
  ReportHeader,
  ReportPage, TituloSecao } from "../../shared/reportUtils";
import { GraficoBarrasHorizontais } from "../../shared/graficos";

type Peca = {
  id: number;
  nome: string;
  descricao?: string | null;
  estoque?: number | null;
  preco_custo?: number | string | null;
  preco_venda?: number | string | null;
};

const margem = (p: Peca) => {
  const custo = Number(p.preco_custo ?? 0);
  const venda = Number(p.preco_venda ?? 0);
  if (!venda) return 0;
  return ((venda - custo) / venda) * 100;
};

const valorEstoque = (p: Peca) => Number(p.estoque ?? 0) * Number(p.preco_custo ?? 0);

const acaoSugerida = (p: Peca) => {
  if (Number(p.estoque ?? 0) <= LIMITE_ESTOQUE_BAIXO) return "Comprar";
  if (!Number(p.preco_custo ?? 0) || !Number(p.preco_venda ?? 0)) return "Corrigir preço";
  if (margem(p) < 20) return "Revisar margem";
  if (valorEstoque(p) >= 1000) return "Avaliar capital parado";
  return "OK";
};

export default function EstoqueCriticoRelatorio() {
  const { user } = useAuth();
  const { error, warning } = useToast();
  const [pecas, setPecas] = React.useState<Peca[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/pecas", { params: { oficina_id: user?.oficina_id } });
        setPecas(data ?? []);
      } catch (err) {
        console.error("Erro ao carregar estoque crítico:", err);
        error("Não foi possível carregar o estoque.");
      } finally {
        setLoading(false);
      }
    })();
  }, [error]);

  const q = query.trim().toLowerCase();
  const filtradas = pecas
    .filter((p) => !q || p.nome.toLowerCase().includes(q) || (p.descricao ?? "").toLowerCase().includes(q))
    .sort((a, b) => {
      const prioridade = (item: Peca) => {
        if (Number(item.estoque ?? 0) <= LIMITE_ESTOQUE_BAIXO) return 0;
        if (!Number(item.preco_custo ?? 0) || !Number(item.preco_venda ?? 0)) return 1;
        if (margem(item) < 20) return 2;
        return 3;
      };
      return prioridade(a) - prioridade(b) || Number(a.estoque ?? 0) - Number(b.estoque ?? 0);
    });

  const criticas = pecas.filter((p) => Number(p.estoque ?? 0) <= LIMITE_ESTOQUE_BAIXO);
  const semPreco = pecas.filter((p) => !Number(p.preco_custo ?? 0) || !Number(p.preco_venda ?? 0));
  const margemBaixa = pecas.filter((p) => Number(p.preco_venda ?? 0) > 0 && margem(p) < 20);
  const capitalParado = pecas.reduce((sum, p) => sum + valorEstoque(p), 0);
  const topCapital = [...pecas].sort((a, b) => valorEstoque(b) - valorEstoque(a)).slice(0, 8);

  const handleExportarCSV = () => {
    if (!filtradas.length) {
      warning("Nenhuma peça para exportar.");
      return;
    }
    exportCsv(
      `relatorio_estoque_critico_${new Date().toISOString().slice(0, 10)}.csv`,
      ["Peça", "Estoque", "Custo", "Venda", "Valor em estoque", "Margem", "Ação sugerida"],
      filtradas.map((p) => [
        p.nome,
        Number(p.estoque ?? 0),
        Number(p.preco_custo ?? 0).toFixed(2).replace(".", ","),
        Number(p.preco_venda ?? 0).toFixed(2).replace(".", ","),
        valorEstoque(p).toFixed(2).replace(".", ","),
        `${margem(p).toFixed(1).replace(".", ",")}%`,
        acaoSugerida(p),
      ])
    );
  };

  if (loading) return <Box sx={{ textAlign: "center", mt: 6 }}><CircularProgress /></Box>;

  return (
    <ReportPage>
      <ReportHeader
        title="Posição de estoque"
        subtitle="Quanto há em estoque, o que comprar com urgência e onde o preço está errado."
        onExport={handleExportarCSV}
      />

      <StatGroup espalhar>
        <MetricCard label="Peças cadastradas" value={pecas.length} />
        <MetricCard label="Comprar urgente" value={criticas.length} tone={criticas.length ? "error" : "default"} helper={`Estoque <= ${LIMITE_ESTOQUE_BAIXO}`} />
        <MetricCard label="Capital em estoque" value={brl(capitalParado)} tone="warning" />
        <MetricCard label="Sem preço correto" value={semPreco.length} tone={semPreco.length ? "error" : "default"} />
        <MetricCard label="Margem baixa" value={margemBaixa.length} tone={margemBaixa.length ? "warning" : "default"} helper="< 20%" />
      </StatGroup>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: { xs: 3, lg: 6 }, mb: 4 }}>
        <Box sx={{ flex: 1 }}>
          <TituloSecao>Maior dinheiro parado</TituloSecao>
          <GraficoBarrasHorizontais
            itens={topCapital.map((p) => ({ rotulo: p.nome, valor: valorEstoque(p) }))}
            semDados="Nenhuma peça cadastrada."
          />
        </Box>

        <Box sx={{ flex: 1 }}>
          <TituloSecao>Filtro</TituloSecao>
          <TextField
            size="small"
            fullWidth
            label="Buscar peça"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Box>
      </Box>

      <TituloSecao>Peças em estoque crítico</TituloSecao>
      <Box sx={{ overflowX: "auto" }}>
        {filtradas.length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Peça</TableCell>
                <TableCell align="right">Estoque</TableCell>
                <TableCell align="right">Custo</TableCell>
                <TableCell align="right">Venda</TableCell>
                <TableCell align="right">Valor estoque</TableCell>
                <TableCell align="right">Margem</TableCell>
                <TableCell>Ação sugerida</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtradas.map((p) => {
                const acao = acaoSugerida(p);
                const tone = acao === "Comprar" || acao === "Corrigir preço" ? "error" : acao === "OK" ? "success" : "warning";
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{p.nome}</Typography>
                      {p.descricao && <Typography variant="caption" color="text.secondary">{p.descricao}</Typography>}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{Number(p.estoque ?? 0)}</TableCell>
                    <TableCell align="right">{brl(Number(p.preco_custo ?? 0))}</TableCell>
                    <TableCell align="right">{brl(Number(p.preco_venda ?? 0))}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{brl(valorEstoque(p))}</TableCell>
                    <TableCell align="right">{margem(p).toFixed(1)}%</TableCell>
                    <TableCell><Chip size="small" label={acao} color={tone} sx={{ fontWeight: 700 }} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : <EmptyReport message="Nenhuma peça encontrada." />}
      </Box>
    </ReportPage>
  );
}
