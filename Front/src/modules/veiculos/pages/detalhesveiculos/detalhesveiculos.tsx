import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, Stack, Paper, Tabs, Tab, CircularProgress,
  IconButton, Avatar, Chip, Divider, Button, Skeleton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import CalendarTodayRoundedIcon from "@mui/icons-material/CalendarTodayRounded";
import PaletteRoundedIcon from "@mui/icons-material/PaletteRounded";
import LocalGasStationRoundedIcon from "@mui/icons-material/LocalGasStationRounded";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import { obterVeiculoDetalhes } from "./apidetalhes/api";
import VeiculoDialog, { type VeiculoForm } from "../../dialog";
import api from "../../../../api/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const brl = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_OS: Record<string, { label: string; color: "warning" | "info" | "success" | "error" }> = {
  aberta:       { label: "Aberta",       color: "warning" },
  em_andamento: { label: "Em andamento", color: "info"    },
  concluida:    { label: "Concluída",    color: "success" },
  cancelada:    { label: "Cancelada",    color: "error"   },
};

const COMBUSTIVEL_LABEL: Record<string, string> = {
  gasolina: "Gasolina", etanol: "Etanol", flex: "Flex",
  diesel: "Diesel", gnv: "GNV", eletrico: "Elétrico", hibrido: "Híbrido",
};

// ─── Subcomponente: linha de informação ───────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ color: "text.disabled", display: "flex" }}>{icon}</Box>
      <Typography variant="body2" color="text.secondary">{label}:</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Stack>
  );
}

// ─── Subcomponente: ordens de serviço ────────────────────────────────────────

function VeiculoOrdens({ ordens }: { ordens: any[] }) {
  if (!ordens?.length) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <AssignmentRoundedIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
        <Typography color="text.disabled">Nenhuma ordem de serviço encontrada</Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} elevation={0}
      sx={{ border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Data</TableCell>
            <TableCell>Mecânico</TableCell>
            <TableCell>Total</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ordens.map((o) => {
            const st = STATUS_OS[o.status] ?? STATUS_OS.aberta;
            return (
              <TableRow key={o.id} hover>
                <TableCell>
                  {o.data_abertura
                    ? new Date(o.data_abertura).toLocaleDateString("pt-BR")
                    : "—"}
                </TableCell>
                <TableCell>{o.funcionario?.nome ?? "—"}</TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={600} color="success.main">
                    {brl(o.valor_total ?? 0)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={st.label} size="small" color={st.color}
                    sx={{ fontWeight: 700, fontSize: 11 }} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: (t) => `1px solid ${t.palette.divider}`, mb: 3 }}>
      <Stack direction="row" spacing={2.5} alignItems="center">
        <Skeleton variant="circular" width={72} height={72} />
        <Stack spacing={1} flex={1}>
          <Skeleton variant="text" width={220} height={28} />
          <Skeleton variant="rounded" width={90} height={22} />
          <Stack direction="row" spacing={1}>
            <Skeleton variant="rounded" width={80} height={20} />
            <Skeleton variant="rounded" width={100} height={20} />
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function VeiculoDetalhesPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [tab, setTab] = React.useState(0);
  const [veiculo, setVeiculo] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [openEdit, setOpenEdit] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await obterVeiculoDetalhes(Number(id));
        setVeiculo(data);
      } catch (err) {
        console.error("Erro ao carregar veículo:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleEditSubmit = async (data: VeiculoForm) => {
    try {
      const res = await api.put(`/veiculos/${id}`, data);
      setVeiculo((prev: any) => ({ ...prev, ...res.data }));
      setOpenEdit(false);
    } catch (err) {
      console.error("Erro ao atualizar veículo:", err);
    }
  };

  const countOrdens = veiculo?.ordens?.length ?? 0;

  return (
    <>
      <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4 } }}>

        {/* ── Breadcrumb ── */}
        <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
          <IconButton onClick={() => nav(-1)} size="small"
            sx={{ bgcolor: "action.hover", borderRadius: 2 }}>
            <ArrowBackRoundedIcon fontSize="small" />
          </IconButton>
          <Typography variant="body2" color="text.secondary">Veículos</Typography>
          <Typography variant="body2" color="text.disabled">/</Typography>
          <Typography variant="body2" fontWeight={600} color="text.primary">
            {loading
              ? <Skeleton width={140} sx={{ display: "inline-block" }} />
              : `${veiculo?.marca} ${veiculo?.modelo}`}
          </Typography>
        </Stack>

        {/* ── Header card ── */}
        {loading ? <HeaderSkeleton /> : veiculo && (
          <Paper elevation={0}
            sx={{ p: 3, borderRadius: 3, border: (t) => `1px solid ${t.palette.divider}`, mb: 3 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={3}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
            >
              {/* Avatar + dados */}
              <Stack direction="row" spacing={2.5} alignItems="center">
                <Avatar sx={{
                  width: 72, height: 72,
                  background: (t) =>
                    `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.primary.dark})`,
                }}>
                  <DirectionsCarRoundedIcon sx={{ fontSize: 36 }} />
                </Avatar>

                <Stack spacing={0.75}>
                  <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
                    {veiculo.marca} {veiculo.modelo}
                  </Typography>

                  {/* Placa estilo visual */}
                  <Box sx={{
                    display: "inline-flex", alignSelf: "flex-start",
                    px: 1.5, py: 0.25, borderRadius: 1,
                    border: (t) => `2px solid ${t.palette.text.primary}`,
                    bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
                  }}>
                    <Typography fontFamily="monospace" fontWeight={800} fontSize={15} letterSpacing={2}>
                      {veiculo.placa}
                    </Typography>
                  </Box>

                  {/* Atributos */}
                  <Stack direction="row" flexWrap="wrap" gap={1.5} mt={0.25}>
                    <InfoRow
                      icon={<CalendarTodayRoundedIcon sx={{ fontSize: 14 }} />}
                      label="Ano" value={veiculo.ano} />
                    <InfoRow
                      icon={<PaletteRoundedIcon sx={{ fontSize: 14 }} />}
                      label="Cor" value={veiculo.cor} />
                    <InfoRow
                      icon={<LocalGasStationRoundedIcon sx={{ fontSize: 14 }} />}
                      label="Combustível"
                      value={veiculo.combustivel ? COMBUSTIVEL_LABEL[veiculo.combustivel] : null} />
                    <InfoRow
                      icon={<SpeedRoundedIcon sx={{ fontSize: 14 }} />}
                      label="Quilometragem"
                      value={veiculo.quilometragem
                        ? `${Number(veiculo.quilometragem).toLocaleString("pt-BR")} km`
                        : null} />
                  </Stack>
                </Stack>
              </Stack>

              {/* Proprietário + editar */}
              <Stack alignItems={{ xs: "flex-start", sm: "flex-end" }} spacing={1}>
                <IconButton
                  onClick={() => setOpenEdit(true)}
                  sx={{ border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 2 }}
                >
                  <EditRoundedIcon fontSize="small" />
                </IconButton>

                {veiculo.cliente && (
                  <Stack spacing={0.25} alignItems={{ xs: "flex-start", sm: "flex-end" }}>
                    <Typography variant="caption" color="text.secondary">Proprietário</Typography>
                    <Button
                      size="small"
                      startIcon={<PersonRoundedIcon fontSize="small" />}
                      onClick={() => nav(`/clientes/${veiculo.cliente_id}`)}
                      sx={{ textTransform: "none", fontWeight: 700, p: 0, minWidth: 0 }}
                    >
                      {veiculo.cliente.nome}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Stack>

            {/* Observação */}
            {veiculo.observacao && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="text.secondary" fontStyle="italic">
                  {veiculo.observacao}
                </Typography>
              </>
            )}
          </Paper>
        )}

        {/* ── Abas ── */}
        <Paper elevation={0}
          sx={{ borderRadius: 3, border: (t) => `1px solid ${t.palette.divider}`, overflow: "hidden" }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              borderBottom: (t) => `1px solid ${t.palette.divider}`,
              px: 2,
              "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: 14, minHeight: 52 },
              "& .Mui-selected": { color: "primary.main" },
            }}
          >
            <Tab label={
              <Stack direction="row" spacing={0.75} alignItems="center">
                <AssignmentRoundedIcon sx={{ fontSize: 16 }} />
                <span>Ordens de Serviço</span>
                {countOrdens > 0 && (
                  <Chip label={countOrdens} size="small"
                    sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />
                )}
              </Stack>
            } />
          </Tabs>

          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {loading ? (
              <Stack spacing={1.5}>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} variant="rounded" height={52} sx={{ borderRadius: 2 }} />
                ))}
              </Stack>
            ) : (
              tab === 0 && <VeiculoOrdens ordens={veiculo?.ordens ?? []} />
            )}
          </Box>
        </Paper>

      </Box>

      {/* ── Dialog editar ── */}
      {veiculo && (
        <VeiculoDialog
          open={openEdit}
          mode="edit"
          initial={{
            id: String(veiculo.id),
            cliente_id: veiculo.cliente_id,
            cliente_nome: veiculo.cliente?.nome || "",
            marca: veiculo.marca,
            modelo: veiculo.modelo,
            ano: veiculo.ano,
            placa: veiculo.placa,
            cor: veiculo.cor,
            combustivel: veiculo.combustivel,
            quilometragem: veiculo.quilometragem,
            observacao: veiculo.observacao,
            criado_em: veiculo.created_at,
          }}
          onClose={() => setOpenEdit(false)}
          onSubmit={handleEditSubmit}
        />
      )}
    </>
  );
}
