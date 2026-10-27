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
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import AssignmentLateRoundedIcon from "@mui/icons-material/AssignmentLateRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import RequestQuoteRoundedIcon from "@mui/icons-material/RequestQuoteRounded";
import PriceCheckRoundedIcon from "@mui/icons-material/PriceCheckRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import EventNoteRoundedIcon from "@mui/icons-material/EventNoteRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import { useNavigate } from "react-router-dom";
import api from "../../../api/api";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { paths } from "../../../routes/paths";
import { brl, daysBetween, LIMITE_ESTOQUE_BAIXO, TituloSecao } from "../shared/reportUtils";

type PreviewData = {
  caixa: { recebido: number; vencido: number; aPagar: number };
  ordens: { abertas: number; paradas: number; valorPreso: number };
  estoque: { criticas: number; capital: number; margemBaixa: number };
  orcamentos: { perdidos: number; valorPerdido: number; pendentes: number };
  rentabilidade: { faturamento: number; lucro: number; margem: number };
};

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 5 }}>
      <TituloSecao>{titulo}</TituloSecao>
      <Grid container spacing={3} sx={{ mt: 0.5 }}>{children}</Grid>
    </Box>
  );
}

function PreviewRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" py={0.5} gap={2}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="caption" fontWeight={600} color={color ?? "text.primary"}>{value}</Typography>
    </Stack>
  );
}

function RelatorioCard({
  titulo,
  descricao,
  icone,
  destino,
  children,
  loading,
}: {
  titulo: string;
  descricao: string;
  icone: React.ReactNode;
  destino: string;
  children?: React.ReactNode;
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
        border: 0,
        overflow: "hidden",
        transition: "border-color 0.2s",
        "&:hover": { borderColor: "primary.main" },
      }}
    >
      <Box sx={{ px: 0, py: 2.5 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ width: 46, height: 46, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "action.hover", color: "text.secondary", "& svg": { fontSize: 25 } }}>
            {icone}
          </Box>
          <Stack flex={1} spacing={0.25} minWidth={0}>
            <Typography fontWeight={700} fontSize={15}>{titulo}</Typography>
            <Typography variant="caption" color="text.secondary">{descricao}</Typography>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ px: 0, py: 1, flex: 1 }}>
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
      <Stack direction="row" justifyContent="flex-end" sx={{ px: 0, py: 1.5 }}>
        <Button
          size="small"
          endIcon={<ArrowForwardRoundedIcon />}
          onClick={() => nav(destino)}
          sx={{ textTransform: "none", fontWeight: 600, color: "primary.main", p: 0, minWidth: 0, "&:hover": { bgcolor: "transparent", opacity: 0.82 } }}
        >
          Abrir relatório
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
        console.error("Erro ao carregar preview de relatórios:", err);
        error("Não foi possível carregar os indicadores dos relatórios.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.oficina_id, error]);

  const p = preview;

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>
      <Stack spacing={0.5} mb={4}>
        <Typography variant="h5" fontWeight={700}>Relatórios</Typography>
        <Typography variant="body2" color="text.secondary">
          Acompanhe o caixa, as vendas, a operação da oficina e o estoque.
        </Typography>
      </Stack>

      <Secao titulo="Financeiro">
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <RelatorioCard titulo="Fluxo de caixa" descricao="Entradas e saídas do período" icone={<AccountBalanceWalletRoundedIcon />} destino={paths.fluxoCaixaRelatorio} loading={loading}>
            <PreviewRow label="Recebido" value={brl(p?.caixa.recebido ?? 0)} />
            <PreviewRow label="A pagar" value={brl(p?.caixa.aPagar ?? 0)} />
          </RelatorioCard>
        </Grid>
      </Secao>

      <Secao titulo="Vendas">
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <RelatorioCard titulo="Conversão de orçamentos" descricao="Aprovados, perdidos e o que dá para recuperar" icone={<RequestQuoteRoundedIcon />} destino={paths.orcamentosRelatorio} loading={loading}>
            <PreviewRow label="Perdidos" value={p?.orcamentos.perdidos ?? 0} />
            <PreviewRow label="Valor perdido" value={brl(p?.orcamentos.valorPerdido ?? 0)} />
            <PreviewRow label="Pendentes" value={p?.orcamentos.pendentes ?? 0} />
          </RelatorioCard>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <RelatorioCard titulo="Margem por OS" descricao="Lucro bruto estimado por ordem de serviço" icone={<PriceCheckRoundedIcon />} destino={paths.margemRelatorio} loading={loading}>
            <PreviewRow label="Faturamento" value={brl(p?.rentabilidade.faturamento ?? 0)} />
            <PreviewRow label="Lucro bruto" value={brl(p?.rentabilidade.lucro ?? 0)} />
            <PreviewRow label="Margem" value={`${(p?.rentabilidade.margem ?? 0).toFixed(1)}%`} />
          </RelatorioCard>
        </Grid>
      </Secao>

      <Secao titulo="Operação">
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <RelatorioCard titulo="Ordens de serviço" descricao="Abertas, paradas e valor preso" icone={<AssignmentLateRoundedIcon />} destino={paths.ordensRelatorio} loading={loading}>
            <PreviewRow label="OS abertas" value={p?.ordens.abertas ?? 0} />
            <PreviewRow label="Paradas há 3+ dias" value={p?.ordens.paradas ?? 0} />
            <PreviewRow label="Valor preso" value={brl(p?.ordens.valorPreso ?? 0)} />
          </RelatorioCard>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <RelatorioCard titulo="Agenda" descricao="Agendamentos do período" icone={<EventNoteRoundedIcon />} destino={paths.agendaRelatorio} loading={false} />
        </Grid>
      </Secao>

      <Secao titulo="Estoque e clientes">
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <RelatorioCard titulo="Posição de estoque" descricao="Valor em estoque, compra urgente e preços" icone={<Inventory2RoundedIcon />} destino={paths.estoqueRelatorio} loading={loading}>
            <PreviewRow label="Peças críticas" value={p?.estoque.criticas ?? 0} />
            <PreviewRow label="Capital em estoque" value={brl(p?.estoque.capital ?? 0)} />
            <PreviewRow label="Margem baixa" value={p?.estoque.margemBaixa ?? 0} />
          </RelatorioCard>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <RelatorioCard titulo="Clientes" descricao="Cadastro e histórico de clientes" icone={<GroupsRoundedIcon />} destino={paths.clientesRelatorio} loading={false} />
        </Grid>
      </Secao>
    </Box>
  );
}
