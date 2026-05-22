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
  ReportHeader,
  ReportPage,
} from "../../shared/reportUtils";

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
  if (!Number(p.preco_custo ?? 0) || !Number(p.preco_venda ?? 0)) return "Corrigir preco";
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
        console.error("Erro ao carregar estoque critico:", err);
        error("Nao foi possivel carregar o estoque.");
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
      warning("Nenhuma peca para exportar.");
      return;
    }
    exportCsv(
      `relatorio_estoque_critico_${new Date().toISOString().slice(0, 10)}.csv`,
      ["Peca", "Estoque", "Custo", "Venda", "Valor em estoque", "Margem", "Acao sugerida"],
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
        title="Relatorio de Estoque Critico e Dinheiro Parado"
        subtitle="Mostra o que comprar, onde ha preco errado e quanto capital esta preso em pecas."
        onExport={handleExportarCSV}
      />

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} mb={2.5}>
        <MetricCard label="Pecas cadastradas" value={pecas.length} />
        <MetricCard label="Comprar urgente" value={criticas.length} tone={criticas.length ? "error" : "default"} helper={`Estoque <= ${LIMITE_ESTOQUE_BAIXO}`} />
        <MetricCard label="Capital em estoque" value={brl(capitalParado)} tone="warning" />
        <MetricCard label="Sem preco correto" value={semPreco.length} tone={semPreco.length ? "error" : "default"} />
        <MetricCard label="Margem baixa" value={margemBaixa.length} tone={margemBaixa.length ? "warning" : "default"} helper="< 20%" />
      </Stack>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={2.5} mb={2.5}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1 }}>
          <Typography fontWeight={800} mb={1}>Maior dinheiro parado</Typography>
          {topCapital.length ? topCapital.map((p) => (
            <Stack key={p.id} direction="row" justifyContent="space-between" py={0.75} gap={2}>
              <Typography variant="body2" noWrap>{p.nome}</Typography>
              <Typography variant="body2" fontWeight={800}>{brl(valorEstoque(p))}</Typography>
            </Stack>
          )) : <Typography variant="body2" color="text.secondary">Nenhuma peca cadastrada.</Typography>}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1 }}>
          <Typography fontWeight={800} mb={1}>Filtro</Typography>
          <TextField
            size="small"
            fullWidth
            label="Buscar peca"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Paper>
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: "auto" }}>
        {filtradas.length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Peca</TableCell>
                <TableCell align="right">Estoque</TableCell>
                <TableCell align="right">Custo</TableCell>
                <TableCell align="right">Venda</TableCell>
                <TableCell align="right">Valor estoque</TableCell>
                <TableCell align="right">Margem</TableCell>
                <TableCell>Acao sugerida</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtradas.map((p) => {
                const acao = acaoSugerida(p);
                const tone = acao === "Comprar" || acao === "Corrigir preco" ? "error" : acao === "OK" ? "success" : "warning";
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>{p.nome}</Typography>
                      {p.descricao && <Typography variant="caption" color="text.secondary">{p.descricao}</Typography>}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>{Number(p.estoque ?? 0)}</TableCell>
                    <TableCell align="right">{brl(Number(p.preco_custo ?? 0))}</TableCell>
                    <TableCell align="right">{brl(Number(p.preco_venda ?? 0))}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>{brl(valorEstoque(p))}</TableCell>
                    <TableCell align="right">{margem(p).toFixed(1)}%</TableCell>
                    <TableCell><Chip size="small" label={acao} color={tone} sx={{ fontWeight: 700 }} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : <EmptyReport message="Nenhuma peca encontrada." />}
      </Paper>
    </ReportPage>
  );
}
