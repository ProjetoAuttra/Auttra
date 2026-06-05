import * as React from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import api from "../../api/api";

type TrackingData = {
  type: "ordem" | "orcamento";
  id: number;
  code: string;
  title: string;
  status: string;
  statusLabel: string;
  statusTone: "success" | "warning" | "info" | "error" | "default";
  progress: number;
  documentUrl: string;
  oficina: { nome: string; telefone?: string | null; email?: string | null; logoUrl?: string | null; endereco?: string | null };
  cliente: { nome: string };
  veiculo: { marca: string; modelo: string; placa: string; ano?: number | null; cor?: string | null; km?: number | null };
  descricao: string;
  total: number;
  datas: { abertura?: string | null; fechamento?: string | null; validade?: string | null };
  responsavel?: string | null;
  itens: { id: number; tipo: string; nome: string; quantidade: number; precoUnitario: number; subtotal: number }[];
  timeline: { key: string; label: string; done: boolean; current: boolean; date?: string | null }[];
};

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const date = (value?: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value)) : "-";

function vehicleLabel(data: TrackingData["veiculo"]) {
  return [data.marca, data.modelo, data.ano].filter(Boolean).join(" ") || "Veículo";
}

export default function PublicTrackingPage() {
  const { code } = useParams();
  const [data, setData] = React.useState<TrackingData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get(`/public/acompanhamento/${code}`)
      .then((response) => {
        if (alive) setData(response.data);
      })
      .catch((err) => {
        if (alive) setError(err?.response?.data?.error ?? "Não foi possível carregar este acompanhamento.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [code]);

  if (loading) {
    return (
      <Box minHeight="100vh" display="grid" sx={{ placeItems: "center", bgcolor: "background.default" }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Carregando acompanhamento...</Typography>
        </Stack>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box minHeight="100vh" display="grid" sx={{ placeItems: "center", bgcolor: "background.default", px: 2 }}>
        <Alert severity="warning" sx={{ maxWidth: 480 }}>
          {error || "Link expirado ou inválido."}
        </Alert>
      </Box>
    );
  }

  const isOrcamento = data.type === "orcamento";
  const actionLabel = isOrcamento ? "Ver orçamento em PDF" : "Ver OS em PDF";

  return (
    <Box minHeight="100vh" sx={{ bgcolor: "background.default", py: { xs: 2, md: 5 } }}>
      <Container maxWidth="md">
        <Paper sx={{ overflow: "hidden", border: "1px solid", borderColor: "divider" }}>
          <Box sx={{ bgcolor: "primary.main", color: "primary.contrastText", p: { xs: 3, md: 4 } }}>
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                <Box>
                  <Typography variant="overline" sx={{ opacity: 0.8 }}>
                    {data.oficina.nome}
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 0.5 }}>
                    {data.title}
                  </Typography>
                </Box>
                <Chip label={data.statusLabel} color={data.statusTone === "default" ? "default" : data.statusTone} sx={{ fontWeight: 800 }} />
              </Stack>

              <Box>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="body2" sx={{ opacity: 0.85 }}>
                    Progresso
                  </Typography>
                  <Typography variant="body2" fontWeight={800}>
                    {data.progress}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={data.progress}
                  sx={{ height: 10, borderRadius: 999, bgcolor: "rgba(255,255,255,0.25)", "& .MuiLinearProgress-bar": { bgcolor: "#fff" } }}
                />
              </Box>
            </Stack>
          </Box>

          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={3}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <InfoBlock label="Cliente" value={data.cliente.nome} />
                <InfoBlock label="Veículo" value={`${vehicleLabel(data.veiculo)} · ${data.veiculo.placa || "-"}`} icon={<DirectionsCarRoundedIcon />} />
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <InfoBlock label={isOrcamento ? "Criado em" : "Entrada"} value={date(data.datas.abertura)} />
                <InfoBlock label={isOrcamento ? "Validade" : "Fechamento"} value={date(isOrcamento ? data.datas.validade : data.datas.fechamento)} />
                <InfoBlock label="Total" value={currency(data.total)} strong />
              </Stack>

              {data.descricao && (
                <Box>
                  <Typography variant="subtitle1" gutterBottom>Descrição</Typography>
                  <Typography color="text.secondary">{data.descricao}</Typography>
                </Box>
              )}

              <Box>
                <Typography variant="subtitle1" gutterBottom>Andamento</Typography>
                <Stack spacing={1.5}>
                  {data.timeline.map((item) => (
                    <Stack key={item.key} direction="row" spacing={1.5} alignItems="center">
                      {item.done ? (
                        <CheckCircleRoundedIcon color={item.current ? data.statusTone === "error" ? "error" : "primary" : "success"} />
                      ) : (
                        <RadioButtonUncheckedRoundedIcon color="disabled" />
                      )}
                      <Box>
                        <Typography fontWeight={item.current ? 800 : 600}>{item.label}</Typography>
                        {item.date && <Typography variant="caption" color="text.secondary">{date(item.date)}</Typography>}
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Box>

              <Box>
                <Typography variant="subtitle1" gutterBottom>Itens</Typography>
                <Stack divider={<Divider flexItem />} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
                  {data.itens.length ? data.itens.map((item) => (
                    <Stack key={item.id} direction="row" justifyContent="space-between" gap={2} sx={{ p: 1.5, bgcolor: "background.paper" }}>
                      <Box>
                        <Typography fontWeight={700}>{item.nome}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Qtd. {item.quantidade} · Unit. {currency(item.precoUnitario)}
                        </Typography>
                      </Box>
                      <Typography fontWeight={800}>{currency(item.subtotal)}</Typography>
                    </Stack>
                  )) : (
                    <Typography color="text.secondary" sx={{ p: 1.5 }}>Nenhum item informado.</Typography>
                  )}
                </Stack>
              </Box>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button href={data.documentUrl} target="_blank" rel="noreferrer" variant="contained" startIcon={<OpenInNewRoundedIcon />}>
                  {actionLabel}
                </Button>
                {data.oficina.telefone && (
                  <Button href={`tel:${data.oficina.telefone}`} variant="outlined" startIcon={<PhoneRoundedIcon />}>
                    Falar com a oficina
                  </Button>
                )}
              </Stack>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

function InfoBlock({ label, value, strong, icon }: { label: string; value: string; strong?: boolean; icon?: React.ReactNode }) {
  return (
    <Box sx={{ flex: 1, p: 2, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        {icon}
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={800} textTransform="uppercase">
            {label}
          </Typography>
          <Typography fontWeight={strong ? 900 : 700}>{value}</Typography>
        </Box>
      </Stack>
    </Box>
  );
}
