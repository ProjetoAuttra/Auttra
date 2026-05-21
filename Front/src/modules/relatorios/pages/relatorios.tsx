import * as React from "react";
import {
  Box, Stack, Typography, Grid, Paper, Button, Skeleton,
  Divider,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import AttachMoneyRoundedIcon from "@mui/icons-material/AttachMoneyRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { useNavigate } from "react-router-dom";
import api from "../../../api/api";
import { useAuth } from "../../../context/AuthContext";

// ─── Tipos ─────────────────────────────────────────────────────────────────

type PreviewData = {
  clientes: { total: number; ativos: number };
  financeiro: { entradas: number; saidas: number; saldo: number };
  agenda: { total: number; confirmados: number };
  geral: { ordens: number; concluidas: number; receita: number };
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Componente de linha de preview ───────────────────────────────────────

function PreviewRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" py={0.5}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="caption" fontWeight={700} color={color ?? "text.primary"}>{value}</Typography>
    </Stack>
  );
}

// ─── Card de relatório ─────────────────────────────────────────────────────

function RelatorioCard({
  titulo, descricao, icone, cor, destino, children, loading,
}: {
  titulo: string; descricao: string; icone: React.ReactNode;
  cor: string; destino: string; children: React.ReactNode; loading: boolean;
}) {
  const nav = useNavigate();

  return (
    <Paper elevation={0} sx={{
      p: 0, borderRadius: 3, height: "100%", display: "flex", flexDirection: "column",
      border: (t) => `1px solid ${t.palette.divider}`, bgcolor: "background.paper",
      overflow: "hidden", transition: "box-shadow 0.2s, transform 0.2s",
      "&:hover": { boxShadow: (t) => `0 8px 28px ${alpha(t.palette.common.black, 0.09)}`, transform: "translateY(-2px)" },
    }}>
      {/* Cabeçalho colorido */}
      <Box sx={{ p: 2.5, background: (t) => `linear-gradient(135deg, ${alpha(cor, 0.12)}, ${alpha(cor, 0.04)})`, borderBottom: (t) => `1px solid ${alpha(cor, 0.15)}` }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ width: 48, height: 48, borderRadius: 2.5, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(cor, 0.15), color: cor, "& svg": { fontSize: 26 } }}>
            {icone}
          </Box>
          <Stack flex={1} spacing={0.25}>
            <Typography fontWeight={800} fontSize={15}>{titulo}</Typography>
            <Typography variant="caption" color="text.secondary">{descricao}</Typography>
          </Stack>
        </Stack>
      </Box>

      {/* Preview de dados */}
      <Box sx={{ px: 2.5, py: 2, flex: 1 }}>
        {loading ? (
          <Stack spacing={1}>
            {[1, 2, 3].map((i) => (
              <Stack key={i} direction="row" justifyContent="space-between">
                <Skeleton variant="text" width="45%" height={16} />
                <Skeleton variant="text" width="25%" height={16} />
              </Stack>
            ))}
          </Stack>
        ) : (
          <>{children}</>
        )}
      </Box>

      <Divider />

      {/* Rodapé */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2.5, py: 1.5 }}>
        <Button
          size="small"
          endIcon={<ArrowForwardRoundedIcon />}
          onClick={() => nav(destino)}
          sx={{ textTransform: "none", fontWeight: 700, color: cor, p: 0, minWidth: 0, "&:hover": { bgcolor: "transparent", opacity: 0.8 } }}
        >
          Visualizar relatório
        </Button>
        <Button
          size="small"
          startIcon={<FileDownloadRoundedIcon />}
          onClick={() => nav(destino)}
          sx={{ textTransform: "none", fontWeight: 600, color: "text.secondary", p: 0, minWidth: 0, fontSize: 12 }}
        >
          CSV
        </Button>
      </Stack>
    </Paper>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────

export default function Relatorios() {
  const { user } = useAuth();
  const [preview, setPreview] = React.useState<PreviewData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user?.oficina_id) return;
    (async () => {
      try {
        const [resClientes, resOrdens, resPagamentos, resAgenda] = await Promise.all([
          api.get("/clientes"),
          api.get("/ordens"),
          api.get("/pagamentos", { params: { oficina_id: user.oficina_id } }),
          api.get("/agendamentos", { params: { oficina_id: user.oficina_id } }).catch(() => ({ data: [] })),
        ]);

        const clientes = resClientes.data ?? [];
        const ordens = resOrdens.data ?? [];
        const pagamentos = resPagamentos.data ?? [];
        const agenda = resAgenda.data ?? [];

        const tipoMap: Record<string, "entrada" | "saida"> = {
          receber: "entrada", entrada: "entrada",
          pagar: "saida", saida: "saida",
        };

        const entradas = pagamentos.filter((p: any) => tipoMap[(p.tipo ?? "").toLowerCase()] === "entrada").reduce((s: number, p: any) => s + Number(p.valor ?? 0), 0);
        const saidas = pagamentos.filter((p: any) => tipoMap[(p.tipo ?? "").toLowerCase()] === "saida").reduce((s: number, p: any) => s + Number(p.valor ?? 0), 0);
        const concluidas = ordens.filter((o: any) => o.status === "concluida");
        const receita = concluidas.reduce((s: number, o: any) => s + Number(o.valor_total ?? 0), 0);

        setPreview({
          clientes: {
            total: clientes.length,
            ativos: clientes.filter((c: any) => c.status === "ativo").length,
          },
          financeiro: {
            entradas,
            saidas,
            saldo: entradas - saidas,
          },
          agenda: {
            total: agenda.length,
            confirmados: agenda.filter((a: any) => a.status === "confirmado").length,
          },
          geral: {
            ordens: ordens.length,
            concluidas: concluidas.length,
            receita,
          },
        });
      } catch (err) {
        console.error("Erro ao carregar preview:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.oficina_id]);

  const p = preview;

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, sm: 3, md: 4 }, py: { xs: 2.5, md: 3 } }}>

      {/* Cabeçalho */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} mb={4} flexWrap="wrap" gap={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5" fontWeight={700}>Relatórios</Typography>
          <Typography variant="body2" color="text.secondary">
            Visão geral dos dados e exportação por categoria
          </Typography>
        </Stack>
        {!loading && p && (
          <Paper elevation={0} sx={{ px: 2.5, py: 1.5, borderRadius: 2.5, border: (t) => `1px solid ${t.palette.divider}`, display: "flex", alignItems: "center", gap: 1 }}>
            <TrendingUpRoundedIcon sx={{ fontSize: 16, color: "success.main" }} />
            <Typography variant="body2" fontWeight={600} color="success.main">
              Saldo: {brl(p.financeiro.saldo)}
            </Typography>
          </Paper>
        )}
      </Stack>

      <Grid container spacing={3}>

        {/* Clientes */}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <RelatorioCard titulo="Clientes" descricao="Listagem e dados dos clientes" icone={<PeopleAltRoundedIcon />} cor="#1976D2" destino="/relatorios/clientes" loading={loading}>
            <PreviewRow label="Total cadastrados" value={p?.clientes.total ?? 0} />
            <PreviewRow label="Clientes ativos" value={p?.clientes.ativos ?? 0} color="success.main" />
            <PreviewRow label="Inativos" value={(p?.clientes.total ?? 0) - (p?.clientes.ativos ?? 0)} />
          </RelatorioCard>
        </Grid>

        {/* Financeiro */}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <RelatorioCard titulo="Financeiro" descricao="Receitas, despesas e fluxo de caixa" icone={<AttachMoneyRoundedIcon />} cor="#10b981" destino="/relatorios/financeiro" loading={loading}>
            <PreviewRow label="Entradas" value={brl(p?.financeiro.entradas ?? 0)} color="success.main" />
            <PreviewRow label="Saídas" value={brl(p?.financeiro.saidas ?? 0)} color="error.main" />
            <PreviewRow label="Saldo" value={brl(p?.financeiro.saldo ?? 0)} color={(p?.financeiro.saldo ?? 0) >= 0 ? "primary.main" : "error.main"} />
          </RelatorioCard>
        </Grid>

        {/* Agenda */}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <RelatorioCard titulo="Agenda" descricao="Agendamentos e ocupação" icone={<CalendarMonthRoundedIcon />} cor="#f59e0b" destino="/relatorios/agenda" loading={loading}>
            <PreviewRow label="Total de agendamentos" value={p?.agenda.total ?? 0} />
            <PreviewRow label="Confirmados" value={p?.agenda.confirmados ?? 0} color="success.main" />
            <PreviewRow label="Pendentes" value={(p?.agenda.total ?? 0) - (p?.agenda.confirmados ?? 0)} color="warning.main" />
          </RelatorioCard>
        </Grid>

        {/* Geral */}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <RelatorioCard titulo="Geral" descricao="Resumo consolidado de serviços" icone={<AssessmentRoundedIcon />} cor="#6366f1" destino="/relatorios/geral" loading={loading}>
            <PreviewRow label="Ordens de serviço" value={p?.geral.ordens ?? 0} />
            <PreviewRow label="Concluídas" value={p?.geral.concluidas ?? 0} color="success.main" />
            <PreviewRow label="Receita total" value={brl(p?.geral.receita ?? 0)} color="primary.main" />
          </RelatorioCard>
        </Grid>
      </Grid>
    </Box>
  );
}