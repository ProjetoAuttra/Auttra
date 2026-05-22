import * as React from "react";
import {
  Box,
  Button,
  Divider,
  Grid,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import AssignmentLateRoundedIcon from "@mui/icons-material/AssignmentLateRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import RequestQuoteRoundedIcon from "@mui/icons-material/RequestQuoteRounded";
import PriceCheckRoundedIcon from "@mui/icons-material/PriceCheckRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { useNavigate } from "react-router-dom";
import api from "../../../api/api";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { paths } from "../../../routes/paths";
import { brl, daysBetween, LIMITE_ESTOQUE_BAIXO } from "../shared/reportUtils";

type PreviewData = {
  caixa: { recebido: number; vencido: number; aPagar: number };
  ordens: { abertas: number; paradas: number; valorPreso: number };
  estoque: { criticas: number; capital: number; margemBaixa: number };
  orcamentos: { perdidos: number; valorPerdido: number; pendentes: number };
  rentabilidade: { faturamento: number; lucro: number; margem: number };
};

function PreviewRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" py={0.5} gap={2}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="caption" fontWeight={800} color={color ?? "text.primary"}>{value}</Typography>
    </Stack>
  );
}

function RelatorioCard({
  titulo,
  descricao,
  icone,
  cor,
  destino,
  children,
  loading,
}: {
  titulo: string;
  descricao: string;
  icone: React.ReactNode;
  cor: string;
  destino: string;
  children: React.ReactNode;
  loading: boolean;
}) {
  const nav = useNavigate();

  return (
    <Paper
      elevation={0}
      sx={{
        p: 0,
        borderRadius: 2,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        border: (t) => `1px solid ${t.palette.divider}`,
        overflow: "hidden",
        transition: "box-shadow 0.2s, transform 0.2s",
        "&:hover": { boxShadow: (t) => `0 8px 28px ${alpha(t.palette.common.black, 0.09)}`, transform: "translateY(-2px)" },
      }}
    >
      <Box sx={{ p: 2.5, background: `linear-gradient(135deg, ${alpha(cor, 0.12)}, ${alpha(cor, 0.04)})`, borderBottom: `1px solid ${alpha(cor, 0.15)}` }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ width: 46, height: 46, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(cor, 0.15), color: cor, "& svg": { fontSize: 25 } }}>
            {icone}
          </Box>
          <Stack flex={1} spacing={0.25} minWidth={0}>
            <Typography fontWeight={800} fontSize={15}>{titulo}</Typography>
            <Typography variant="caption" color="text.secondary">{descricao}</Typography>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ px: 2.5, py: 2, flex: 1 }}>
        {loading ? (
          <Stack spacing={1}>
            {[1, 2, 3].map((i) => (
              <Stack key={i} direction="row" justifyContent="space-between">
                <Skeleton variant="text" width="50%" height={16} />
                <Skeleton variant="text" width="28%" height={16} />
              </Stack>
            ))}
          </Stack>
        ) : children}
      </Box>

      <Divider />
      <Stack direction="row" justifyContent="flex-end" sx={{ px: 2.5, py: 1.5 }}>
        <Button
          size="small"
          endIcon={<ArrowForwardRoundedIcon />}
          onClick={() => nav(destino)}
          sx={{ textTransform: "none", fontWeight: 800, color: cor, p: 0, minWidth: 0, "&:hover": { bgcolor: "transparent", opacity: 0.82 } }}
        >
          Abrir relatorio
        </Button>
      </Stack>
    </Paper>
  );
}

export default function Relatorios() {
  const { user } = useAuth();
  const { error } = useToast();
  const [preview, setPreview] = React.useState<PreviewData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user?.oficina_id) return;
    (async () => {
      try {
        const [resPagamentos, resOrdens, resPecas, resOrcamentos] = await Promise.all([
          api.get("/pagamentos", { params: { oficina_id: user.oficina_id } }),
          api.get("/ordens", { params: { oficina_id: user.oficina_id } }),
          api.get("/pecas", { params: { oficina_id: user.oficina_id } }),
          api.get("/orcamentos", { params: { oficina_id: user.oficina_id } }),
        ]);

        const pagamentos = resPagamentos.data ?? [];
        const ordens = resOrdens.data ?? [];
        const pecas = resPecas.data ?? [];
        const orcamentos = resOrcamentos.data ?? [];
        const hoje = new Date();

        const recebido = pagamentos
          .filter((p: any) => p.tipo === "receber" && p.status === "pago")
          .reduce((sum: number, p: any) => sum + Number(p.valor_pago || p.valor || 0), 0);
        const vencido = pagamentos
          .filter((p: any) => p.tipo === "receber" && (p.status === "pendente" || p.status === "parcial") && p.data_vencimento && new Date(p.data_vencimento) < hoje)
          .reduce((sum: number, p: any) => sum + Math.max(0, Number(p.valor || 0) - Number(p.valor_pago || 0)), 0);
        const aPagar = pagamentos
          .filter((p: any) => p.tipo === "pagar" && p.status !== "pago" && p.status !== "cancelado")
          .reduce((sum: number, p: any) => sum + Math.max(0, Number(p.valor || 0) - Number(p.valor_pago || 0)), 0);

        const abertas = ordens.filter((o: any) => o.status !== "concluida" && o.status !== "cancelada");
        const paradas = abertas.filter((o: any) => daysBetween(o.data_abertura) >= 3);
        const valorPreso = abertas.reduce((sum: number, o: any) => sum + Number(o.valor_total || 0), 0);

        const capital = pecas.reduce((sum: number, p: any) => sum + Number(p.estoque || 0) * Number(p.preco_custo || 0), 0);
        const criticas = pecas.filter((p: any) => Number(p.estoque || 0) <= LIMITE_ESTOQUE_BAIXO).length;
        const margemBaixa = pecas.filter((p: any) => {
          const venda = Number(p.preco_venda || 0);
          const custo = Number(p.preco_custo || 0);
          return venda > 0 && ((venda - custo) / venda) * 100 < 20;
        }).length;

        const perdidos = orcamentos.filter((o: any) => o.status === "recusado");
        const pendentes = orcamentos.filter((o: any) => o.status === "analise");
        const valorPerdido = perdidos.reduce((sum: number, o: any) => sum + Number(o.valor || 0), 0);

        const concluidas = ordens.filter((o: any) => o.status === "concluida");
        const faturamento = concluidas.reduce((sum: number, o: any) => sum + Number(o.valor_total || 0), 0);
        const custo = concluidas.reduce((sum: number, o: any) => sum + (o.itens ?? [])
          .filter((item: any) => item.tipo_item === "peca")
          .reduce((itemSum: number, item: any) => itemSum + Number(item.quantidade || 1) * Number(item.peca?.preco_custo || 0), 0), 0);
        const lucro = faturamento - custo;

        setPreview({
          caixa: { recebido, vencido, aPagar },
          ordens: { abertas: abertas.length, paradas: paradas.length, valorPreso },
          estoque: { criticas, capital, margemBaixa },
          orcamentos: { perdidos: perdidos.length, valorPerdido, pendentes: pendentes.length },
          rentabilidade: { faturamento, lucro, margem: faturamento ? (lucro / faturamento) * 100 : 0 },
        });
      } catch (err) {
        console.error("Erro ao carregar preview de relatorios:", err);
        error("Nao foi possivel carregar os indicadores dos relatorios.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.oficina_id, error]);

  const p = preview;

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, sm: 3, md: 4 }, py: { xs: 2.5, md: 3 } }}>
      <Stack spacing={0.5} mb={4}>
        <Typography variant="h5" fontWeight={700}>Relatorios</Typography>
        <Typography variant="body2" color="text.secondary">
          Relatorios essenciais para cobrar, destravar servicos, comprar melhor e revisar margem.
        </Typography>
      </Stack>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <RelatorioCard titulo="Caixa e Inadimplencia" descricao="Entradas, vencidos e pressao de caixa" icone={<AccountBalanceWalletRoundedIcon />} cor="#16a34a" destino={paths.financeiroRelatorio} loading={loading}>
            <PreviewRow label="Recebido" value={brl(p?.caixa.recebido ?? 0)} color="success.main" />
            <PreviewRow label="Vencido" value={brl(p?.caixa.vencido ?? 0)} color={(p?.caixa.vencido ?? 0) > 0 ? "error.main" : "text.primary"} />
            <PreviewRow label="A pagar" value={brl(p?.caixa.aPagar ?? 0)} color="warning.main" />
          </RelatorioCard>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <RelatorioCard titulo="OS em Aberto e Paradas" descricao="Servicos travados e valor preso" icone={<AssignmentLateRoundedIcon />} cor="#0ea5e9" destino={paths.ordensParadasRelatorio} loading={loading}>
            <PreviewRow label="OS abertas" value={p?.ordens.abertas ?? 0} />
            <PreviewRow label="Paradas ha 3+ dias" value={p?.ordens.paradas ?? 0} color={(p?.ordens.paradas ?? 0) > 0 ? "warning.main" : "text.primary"} />
            <PreviewRow label="Valor preso" value={brl(p?.ordens.valorPreso ?? 0)} color="warning.main" />
          </RelatorioCard>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <RelatorioCard titulo="Estoque Critico" descricao="Compra urgente e dinheiro parado" icone={<Inventory2RoundedIcon />} cor="#7c3aed" destino={paths.estoqueCriticoRelatorio} loading={loading}>
            <PreviewRow label="Pecas criticas" value={p?.estoque.criticas ?? 0} color={(p?.estoque.criticas ?? 0) > 0 ? "error.main" : "text.primary"} />
            <PreviewRow label="Capital em estoque" value={brl(p?.estoque.capital ?? 0)} color="warning.main" />
            <PreviewRow label="Margem baixa" value={p?.estoque.margemBaixa ?? 0} />
          </RelatorioCard>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <RelatorioCard titulo="Orcamentos Perdidos" descricao="Receita nao convertida e follow-up" icone={<RequestQuoteRoundedIcon />} cor="#ef4444" destino={paths.orcamentosPerdidosRelatorio} loading={loading}>
            <PreviewRow label="Perdidos" value={p?.orcamentos.perdidos ?? 0} color="error.main" />
            <PreviewRow label="Valor perdido" value={brl(p?.orcamentos.valorPerdido ?? 0)} color="error.main" />
            <PreviewRow label="Pendentes" value={p?.orcamentos.pendentes ?? 0} color="warning.main" />
          </RelatorioCard>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <RelatorioCard titulo="Rentabilidade por OS" descricao="Lucro bruto estimado e margem baixa" icone={<PriceCheckRoundedIcon />} cor="#0891b2" destino={paths.rentabilidadeRelatorio} loading={loading}>
            <PreviewRow label="Faturamento" value={brl(p?.rentabilidade.faturamento ?? 0)} color="primary.main" />
            <PreviewRow label="Lucro bruto" value={brl(p?.rentabilidade.lucro ?? 0)} color={(p?.rentabilidade.lucro ?? 0) >= 0 ? "success.main" : "error.main"} />
            <PreviewRow label="Margem" value={`${(p?.rentabilidade.margem ?? 0).toFixed(1)}%`} />
          </RelatorioCard>
        </Grid>
      </Grid>
    </Box>
  );
}
