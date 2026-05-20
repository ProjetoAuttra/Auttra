import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, Stack, Paper, Tabs, Tab, CircularProgress, IconButton,
  Avatar, Chip, Divider, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Select, FormControl, InputLabel, Skeleton,
} from "@mui/material";

import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import CalendarTodayRoundedIcon from "@mui/icons-material/CalendarTodayRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import { obterClienteDetalhes } from "./apidetalhes/api";
import ClientDialog, { type Client, type ClientForm } from "../../dialog";
import api from "../../../../api/api";
import ClienteVeiculos from "./subcomponentes/clienteveiculos";
import ClienteOrdens from "./subcomponentes/clienteordens";
import ClientePagamentos from "./subcomponentes/clientepagamentos";

// ─── Skeleton do cabeçalho ────────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: (t) => `1px solid ${t.palette.divider}`, mb: 3 }}>
      <Stack direction="row" spacing={3} alignItems="center">
        <Skeleton variant="circular" width={72} height={72} />
        <Stack spacing={1} flex={1}>
          <Skeleton variant="text" width={200} height={28} />
          <Skeleton variant="text" width={140} height={20} />
          <Stack direction="row" spacing={1}>
            <Skeleton variant="rounded" width={80} height={24} />
            <Skeleton variant="rounded" width={100} height={24} />
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────

export default function ClienteDetalhesPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [tab, setTab] = React.useState(0);
  const [cliente, setCliente] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [openWhats, setOpenWhats] = React.useState(false);
  const [openEdit, setOpenEdit] = React.useState(false);
  const [mensagem, setMensagem] = React.useState("");
  const [modelo, setModelo] = React.useState("");

  const MODELOS: Record<string, string> = {
    pagamento_pendente: "Olá! Somos da oficina. Notamos que existe um pagamento pendente. Poderia verificar?",
    veiculo_pronto: "Olá! Seu veículo está pronto para retirada. Obrigado pela preferência!",
    aprovacao_orcamento: "Olá! Seu orçamento está disponível para aprovação. Poderia verificar e nos retornar?",
    agradecimento: "Olá! Passando para agradecer pela preferência. Qualquer dúvida, estamos à disposição!",
  };

  React.useEffect(() => {
    (async () => {
      try {
        const data = await obterClienteDetalhes(Number(id));
        setCliente(data);
      } catch (err) { console.error("Erro ao carregar cliente:", err); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const handleEditSubmit = async (data: ClientForm) => {
    try {
      const res = await api.put(`/clientes/${id}`, {
        nome: data.nome,
        email: data.email || null,
        cpf: data.cpf || null,
        telefone: data.telefone || null,
        data_nascimento: data.data_nascimento ? new Date(data.data_nascimento).toISOString() : null,
        observacao: data.observacao || null,
        cep: data.cep || null,
        logradouro: data.logradouro || null,
        numero: data.numero || null,
        complemento: data.complemento || null,
        cidade_id: data.cidade_id ?? null,
      });
      setCliente(res.data);
      setOpenEdit(false);
    } catch (err) {
      console.error("Erro ao atualizar cliente:", err);
    }
  };

  const enviarWhats = () => {
    const numero = cliente?.telefone?.replace(/[^0-9]/g, "");
    if (!numero) return;
    window.open(`https://wa.me/55${numero}?text=${encodeURIComponent(mensagem)}`, "_blank");
    setOpenWhats(false);
  };

  const inicial = cliente?.nome?.[0]?.toUpperCase() ?? "?";

  // ── Contadores para badge das abas ──
  const countVeiculos = cliente?.veiculos?.length ?? 0;
  const countOrdens = cliente?.ordens?.length ?? 0;
  const countPagamentos = cliente?.pagamentos?.length ?? 0;

  return (
    <>
      <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4 } }}>

        {/* ── Navegação ── */}
        <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
          <IconButton onClick={() => nav(-1)} size="small" sx={{ bgcolor: "action.hover", borderRadius: 2 }}>
            <ArrowBackRoundedIcon fontSize="small" />
          </IconButton>
          <Typography variant="body2" color="text.secondary">Clientes</Typography>
          <Typography variant="body2" color="text.disabled">/</Typography>
          <Typography variant="body2" fontWeight={600} color="text.primary">
            {loading ? <Skeleton width={100} /> : cliente?.nome}
          </Typography>
        </Stack>

        {/* ── Card de cabeçalho ── */}
        {loading ? <HeaderSkeleton /> : cliente && (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: (t) => `1px solid ${t.palette.divider}`, mb: 3 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between">

              {/* Avatar + info ── */}
              <Stack direction="row" spacing={2.5} alignItems="center">
                <Avatar sx={{
                  width: 72, height: 72, fontSize: 28, fontWeight: 800,
                  background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.primary.dark})`,
                }}>
                  {inicial}
                </Avatar>
                <Stack spacing={0.5}>
                  <Typography variant="h6" fontWeight={800} lineHeight={1.2}>{cliente.nome}</Typography>
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={0.5}>
                    {cliente.email && (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <EmailRoundedIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                        <Typography variant="body2" color="text.secondary">{cliente.email}</Typography>
                      </Stack>
                    )}
                    {cliente.telefone && (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <PhoneRoundedIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                        <Typography variant="body2" color="text.secondary">{cliente.telefone}</Typography>
                      </Stack>
                    )}
                    {cliente.cpf && (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <BadgeRoundedIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                        <Typography variant="body2" color="text.secondary">{cliente.cpf}</Typography>
                      </Stack>
                    )}
                  </Stack>
                  {cliente.data_nascimento && (
                    <Stack direction="row" spacing={0.5} alignItems="center" mt={0.25}>
                      <CalendarTodayRoundedIcon sx={{ fontSize: 13, color: "text.disabled" }} />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(cliente.data_nascimento).toLocaleDateString("pt-BR")}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </Stack>

              {/* Ações ── */}
              <Stack direction="row" spacing={1}>
                {cliente.telefone && (
                  <Button
                    variant="contained"
                    startIcon={<WhatsAppIcon />}
                    onClick={() => setOpenWhats(true)}
                    disableElevation
                    sx={{ bgcolor: "#25D366", "&:hover": { bgcolor: "#1CA653" }, textTransform: "none", fontWeight: 600, borderRadius: 999 }}
                  >
                    WhatsApp
                  </Button>
                )}
                <IconButton
                  onClick={() => setOpenEdit(true)}
                  sx={{ border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 2 }}
                >
                  <EditRoundedIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>

            {/* Observação ── */}
            {cliente.observacao && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                  {cliente.observacao}
                </Typography>
              </>
            )}
          </Paper>
        )}

        {/* ── Abas ── */}
        <Paper elevation={0} sx={{ borderRadius: 3, border: (t) => `1px solid ${t.palette.divider}`, overflow: "hidden" }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: (t) => `1px solid ${t.palette.divider}`,
              px: 2,
              "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: 14, minHeight: 52 },
              "& .Mui-selected": { color: "primary.main" },
            }}
          >
            <Tab label={
              <Stack direction="row" spacing={0.75} alignItems="center">
                <DirectionsCarRoundedIcon sx={{ fontSize: 16 }} />
                <span>Veículos</span>
                {countVeiculos > 0 && <Chip label={countVeiculos} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />}
              </Stack>
            } />
            <Tab label={
              <Stack direction="row" spacing={0.75} alignItems="center">
                <AssignmentRoundedIcon sx={{ fontSize: 16 }} />
                <span>Ordens de Serviço</span>
                {countOrdens > 0 && <Chip label={countOrdens} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />}
              </Stack>
            } />
            <Tab label={
              <Stack direction="row" spacing={0.75} alignItems="center">
                <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 16 }} />
                <span>Pagamentos</span>
                {countPagamentos > 0 && <Chip label={countPagamentos} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />}
              </Stack>
            } />
          </Tabs>

          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {loading ? (
              <Stack spacing={1.5}>
                {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={64} sx={{ borderRadius: 2 }} />)}
              </Stack>
            ) : (
              <>
                {tab === 0 && <ClienteVeiculos veiculos={cliente?.veiculos ?? []} />}
                {tab === 1 && <ClienteOrdens ordens={cliente?.ordens ?? []} />}
                {tab === 2 && <ClientePagamentos pagamentos={cliente?.pagamentos ?? []} />}
              </>
            )}
          </Box>
        </Paper>
      </Box>

      {/* ── Dialog WhatsApp ── */}
      <Dialog open={openWhats} onClose={() => setOpenWhats(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>Enviar mensagem no WhatsApp</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel>Modelo de mensagem</InputLabel>
              <Select value={modelo} label="Modelo de mensagem"
                onChange={(e) => { setModelo(e.target.value); setMensagem(MODELOS[e.target.value] ?? ""); }}>
                <MenuItem value="pagamento_pendente">Pagamento pendente</MenuItem>
                <MenuItem value="veiculo_pronto">Veículo pronto para retirada</MenuItem>
                <MenuItem value="aprovacao_orcamento">Aprovação de orçamento</MenuItem>
                <MenuItem value="agradecimento">Agradecimento</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Mensagem" multiline rows={4} fullWidth value={mensagem}
              onChange={(e) => setMensagem(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenWhats(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={enviarWhats} disabled={!mensagem}
            sx={{ bgcolor: "#25D366", "&:hover": { bgcolor: "#1CA653" }, textTransform: "none", fontWeight: 700, borderRadius: 999 }}>
            Enviar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog Editar Cliente ── */}
      {cliente && (
        <ClientDialog
          open={openEdit}
          mode="edit"
          initial={{
            id: String(cliente.id),
            nome: cliente.nome,
            email: cliente.email,
            cpf: cliente.cpf,
            telefone: cliente.telefone,
            data_nascimento: cliente.data_nascimento,
            observacao: cliente.observacao,
            cep: cliente.cep,
            logradouro: cliente.logradouro,
            numero: cliente.numero,
            complemento: cliente.complemento,
            cidade_id: cliente.cidade_id,
            cidade: cliente.cidade ? { nome: cliente.cidade.nome, uf: cliente.cidade.uf } : null,
          } as Client}
          onClose={() => setOpenEdit(false)}
          onSubmit={handleEditSubmit}
        />
      )}
    </>
  );
}