import * as React from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { isAxiosError } from "axios";
import api from "../../api/api";
import { brand } from "../../app/theme";
import { maskTelefone } from "../../utils/masks";
import { formatarQuantidade } from "../../utils/quantidade";
import { linkWhatsApp, soDigitos } from "../../utils/whatsapp";

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
  oficina: { nome: string; telefone?: string | null; whatsapp?: string | null; email?: string | null; logoUrl?: string | null; endereco?: string | null };
  cliente: { nome: string };
  veiculo: { marca: string; modelo: string; placa: string; ano?: number | null; cor?: string | null; km?: number | null };
  descricao: string;
  total: number;
  datas: { abertura?: string | null; fechamento?: string | null; validade?: string | null };
  responsavel?: string | null;
  itens: { id: number; tipo: string; nome: string; quantidade: number; unidade?: string | null; precoUnitario: number; subtotal: number }[];
  timeline: { key: string; label: string; done: boolean; current: boolean; date?: string | null }[];
  /** Só no orçamento. */
  vencido?: boolean;
  podeResponder?: boolean;
  resposta?: { decisao: "aprovado" | "recusado"; em: string | null; nome: string | null; motivo: string | null } | null;
};

type Decisao = "aprovar" | "recusar";

/** Espelha os limites do back (publicTracking.service.ts). */
const NOME_MAX = 120;
const MOTIVO_MAX = 500;

const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const date = (value?: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value)) : "-";

// Validade é só-dia (meia-noite UTC): no fuso do Brasil apareceria um dia antes.
const dateOnly = (value?: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(value)) : "-";

const dateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value))
    : "-";

/** Contato da oficina: WhatsApp (abre a conversa com a mensagem pronta) ou, sem ele, o telefone. */
function contatoOficina(data: TrackingData) {
  const whatsapp = soDigitos(data.oficina.whatsapp);
  if (whatsapp) {
    const placa = data.veiculo.placa ? ` (${data.veiculo.placa})` : "";
    const texto = `Olá! Tenho uma dúvida sobre o ${data.title}${placa}.`;
    return { tipo: "whatsapp" as const, numero: maskTelefone(whatsapp), href: linkWhatsApp(whatsapp, texto) };
  }
  const telefone = soDigitos(data.oficina.telefone);
  if (telefone) return { tipo: "telefone" as const, numero: maskTelefone(telefone), href: `tel:+55${telefone}` };
  return null;
}

function vehicleLabel(data: TrackingData["veiculo"]) {
  return [data.marca, data.modelo, data.ano].filter(Boolean).join(" ") || "Veículo";
}

export default function PublicTrackingPage() {
  const { code } = useParams();
  const [data, setData] = React.useState<TrackingData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [decisao, setDecisao] = React.useState<Decisao | null>(null);
  const [nome, setNome] = React.useState("");
  const [motivo, setMotivo] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [erroResposta, setErroResposta] = React.useState("");

  const abrirResposta = (qual: Decisao) => {
    setDecisao(qual);
    setErroResposta("");
  };

  const fecharResposta = () => {
    if (!enviando) setDecisao(null);
  };

  const responder = async () => {
    if (!decisao) return;
    setEnviando(true);
    setErroResposta("");
    try {
      const body = decisao === "recusar" ? { nome, motivo } : { nome };
      const response = await api.post(`/public/acompanhamento/${code}/${decisao}`, body);
      setData(response.data);
      setDecisao(null);
    } catch (err) {
      const resposta = isAxiosError<{ message?: string; error?: string }>(err) ? err.response : undefined;
      const status = resposta?.status;
      const mensagem = resposta?.data?.message ?? resposta?.data?.error;
      setErroResposta(mensagem ?? "Não foi possível enviar sua resposta. Tente novamente.");
      // Já respondido ou vencido: recarrega para mostrar a situação atual e tirar os botões.
      if (status === 409) {
        setDecisao(null);
        api.get(`/public/acompanhamento/${code}`).then((r) => setData(r.data)).catch(() => {});
      }
    } finally {
      setEnviando(false);
    }
  };

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

  const contato = contatoOficina(data);

  return (
    <Box minHeight="100vh" sx={{ bgcolor: "background.default", py: { xs: 2, md: 4 } }}>
      <Container maxWidth="lg">
        <Paper sx={{ overflow: "hidden", border: "1px solid", borderColor: "divider", mb: 2 }}>
          <Box sx={{ bgcolor: "primary.main", color: "primary.contrastText", px: { xs: 2.5, md: 3 }, py: { xs: 2.5, md: 3 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                <Box>
                  <Typography variant="overline" sx={{ opacity: 0.8 }}>
                    {data.oficina.nome}
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 0.5 }}>
                    {data.title}
                  </Typography>
                </Box>
                <Chip
                  label={data.statusLabel}
                  color={data.statusTone === "default" ? "default" : data.statusTone}
                  sx={{ fontWeight: 700, display: { sm: "none" } }}
                />
              </Stack>
              <Stack spacing={1} sx={{ width: { xs: "100%", sm: 320 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Chip
                    label={data.statusLabel}
                    color={data.statusTone === "default" ? "default" : data.statusTone}
                    sx={{ fontWeight: 700, display: { xs: "none", sm: "inline-flex" } }}
                  />
                  <Typography variant="body2" fontWeight={600} sx={{ ml: "auto" }}>
                    Progresso {data.progress}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={data.progress}
                  sx={{ height: 8, borderRadius: 999, bgcolor: "rgba(255,255,255,0.25)", "& .MuiLinearProgress-bar": { bgcolor: "#fff" } }}
                />
              </Stack>
            </Stack>
          </Box>
        </Paper>

        <Grid container spacing={2} alignItems="flex-start">
          {/* Centro: o documento (dados, resposta, itens). */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{ border: "1px solid", borderColor: "divider", p: { xs: 2, md: 3 } }}>
              <Stack spacing={2.5}>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <InfoBlock label="Cliente" value={data.cliente.nome} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <InfoBlock label="Veículo" value={`${vehicleLabel(data.veiculo)} · ${data.veiculo.placa || "-"}`} icon={<DirectionsCarRoundedIcon />} />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <InfoBlock label={isOrcamento ? "Criado em" : "Entrada"} value={date(data.datas.abertura)} />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <InfoBlock label={isOrcamento ? "Validade" : "Fechamento"} value={isOrcamento ? dateOnly(data.datas.validade) : date(data.datas.fechamento)} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <InfoBlock label="Total" value={currency(data.total)} strong />
                  </Grid>
                </Grid>

                {isOrcamento && (
                  <RespostaOrcamento
                    data={data}
                    erro={decisao ? "" : erroResposta}
                    onAprovar={() => abrirResposta("aprovar")}
                    onRecusar={() => abrirResposta("recusar")}
                  />
                )}

                {data.descricao && (
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>Descrição</Typography>
                    <Typography color="text.secondary">{data.descricao}</Typography>
                  </Box>
                )}

                <Box>
                  <Typography variant="subtitle1" gutterBottom>Itens</Typography>
                  <Stack divider={<Divider flexItem />} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
                    {data.itens.length ? data.itens.map((item) => (
                      <Stack key={item.id} direction="row" justifyContent="space-between" gap={2} sx={{ p: 1.5, bgcolor: "background.paper" }}>
                        <Box>
                          <Typography fontWeight={700}>{item.nome}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Qtd. {formatarQuantidade(item.quantidade, item.unidade)} · Unit. {currency(item.precoUnitario)}
                          </Typography>
                        </Box>
                        <Typography fontWeight={700} sx={{ whiteSpace: "nowrap" }}>{currency(item.subtotal)}</Typography>
                      </Stack>
                    )) : (
                      <Typography color="text.secondary" sx={{ p: 1.5 }}>Nenhum item informado.</Typography>
                    )}
                    <Stack direction="row" justifyContent="space-between" sx={{ p: 1.5, bgcolor: "action.hover" }}>
                      <Typography fontWeight={800}>Total</Typography>
                      <Typography fontWeight={800}>{currency(data.total)}</Typography>
                    </Stack>
                  </Stack>
                </Box>

                <Box>
                  <Button href={data.documentUrl} target="_blank" rel="noreferrer" variant="outlined" startIcon={<OpenInNewRoundedIcon />}>
                    {actionLabel}
                  </Button>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          {/* Lateral: andamento e contato da oficina. Fica parada enquanto o documento rola. */}
          <Grid size={{ xs: 12, md: 4 }} sx={{ position: { md: "sticky" }, top: { md: 16 } }}>
            <Stack spacing={2}>
              <Paper sx={{ border: "1px solid", borderColor: "divider", p: { xs: 2, md: 2.5 } }}>
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
              </Paper>

              <Paper sx={{ border: "1px solid", borderColor: "divider", p: { xs: 2, md: 2.5 } }} data-testid="contato-oficina">
                <Typography variant="subtitle1">{data.oficina.nome}</Typography>
                {data.oficina.endereco && (
                  <Typography variant="body2" color="text.secondary">{data.oficina.endereco}</Typography>
                )}
                {contato ? (
                  <Stack spacing={1} sx={{ mt: 1.5 }}>
                    <Typography fontWeight={700}>{contato.numero}</Typography>
                    <Button
                      href={contato.href}
                      target={contato.tipo === "whatsapp" ? "_blank" : undefined}
                      rel="noreferrer"
                      variant="contained"
                      disableElevation
                      startIcon={contato.tipo === "whatsapp" ? <WhatsAppIcon /> : <PhoneRoundedIcon />}
                      sx={
                        contato.tipo === "whatsapp"
                          ? { bgcolor: brand.whatsapp, "&:hover": { bgcolor: brand.whatsappHover }, fontWeight: 700 }
                          : { fontWeight: 700 }
                      }
                    >
                      {contato.tipo === "whatsapp" ? "Falar com a oficina no WhatsApp" : "Ligar para a oficina"}
                    </Button>
                  </Stack>
                ) : null}
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Container>

      <Dialog open={!!decisao} onClose={fecharResposta} fullWidth maxWidth="xs">
        <DialogTitle>{decisao === "recusar" ? "Recusar orçamento" : "Aprovar orçamento"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {decisao === "recusar"
                ? "A oficina será avisada de que você não quer seguir com este orçamento."
                : `Você autoriza a oficina a fazer o serviço no valor de ${currency(data.total)}.`}
            </Typography>
            <TextField
              label="Seu nome (opcional)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              inputProps={{ maxLength: NOME_MAX }}
              fullWidth
            />
            {decisao === "recusar" && (
              <TextField
                label="Motivo (opcional)"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                inputProps={{ maxLength: MOTIVO_MAX }}
                helperText={`${motivo.length}/${MOTIVO_MAX}`}
                multiline
                minRows={3}
                fullWidth
              />
            )}
            {erroResposta && <Alert severity="error">{erroResposta}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={fecharResposta} disabled={enviando}>Voltar</Button>
          <Button
            variant="contained"
            color={decisao === "recusar" ? "error" : "success"}
            onClick={responder}
            disabled={enviando}
            disableElevation
          >
            {enviando ? "Enviando..." : decisao === "recusar" ? "Confirmar recusa" : "Confirmar aprovação"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/** Botões de aprovar/recusar, ou a resposta já dada, ou o aviso de vencido. */
function RespostaOrcamento({ data, erro, onAprovar, onRecusar }: { data: TrackingData; erro: string; onAprovar: () => void; onRecusar: () => void }) {
  if (data.resposta) {
    const aprovou = data.resposta.decisao === "aprovado";
    return (
      <Alert severity={aprovou ? "success" : "info"} data-testid="resposta-cliente">
        {aprovou ? "Orçamento aprovado" : "Orçamento recusado"} em {dateTime(data.resposta.em)}
        {data.resposta.nome ? ` por ${data.resposta.nome}` : ""}.
        {aprovou ? " A oficina já foi avisada." : ""}
        {!aprovou && data.resposta.motivo ? ` Motivo: ${data.resposta.motivo}` : ""}
      </Alert>
    );
  }
  if (data.status === "analise" && data.vencido) {
    return (
      <Alert severity="warning">
        Este orçamento venceu em {dateOnly(data.datas.validade)}. Fale com a oficina para receber um novo.
      </Alert>
    );
  }
  if (!data.podeResponder) return erro ? <Alert severity="error">{erro}</Alert> : null;
  return (
    <Stack spacing={1.5}>
      {erro && <Alert severity="error">{erro}</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <Button variant="contained" color="success" size="large" onClick={onAprovar} disableElevation sx={{ flex: 1, fontWeight: 700 }}>
          Aprovar orçamento
        </Button>
        <Button
          variant="outlined"
          size="large"
          onClick={onRecusar}
          sx={{ flex: 1, fontWeight: 700, color: brand.error, borderColor: brand.error, "&:hover": { borderColor: brand.error, bgcolor: "rgba(220, 38, 38, 0.06)" } }}
        >
          Recusar
        </Button>
      </Stack>
    </Stack>
  );
}

function InfoBlock({ label, value, strong, icon }: { label: string; value: string; strong?: boolean; icon?: React.ReactNode }) {
  return (
    <Box sx={{ flex: 1, p: 2, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        {icon}
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
            {label}
          </Typography>
          <Typography fontWeight={strong ? 900 : 700}>{value}</Typography>
        </Box>
      </Stack>
    </Box>
  );
}
