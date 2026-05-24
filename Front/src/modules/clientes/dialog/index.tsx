import * as React from "react";
import {
  Stack,
  TextField,
  Button,
  Grid,
  InputAdornment,
  Collapse,
  Alert,
  Box,
  CircularProgress,
  Typography,
} from "@mui/material";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import CalendarTodayRoundedIcon from "@mui/icons-material/CalendarTodayRounded";
import NotesRoundedIcon from "@mui/icons-material/NotesRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import NumbersRoundedIcon from "@mui/icons-material/NumbersRounded";
import LocationCityRoundedIcon from "@mui/icons-material/LocationCityRounded";
import FmdGoodRoundedIcon from "@mui/icons-material/FmdGoodRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { AppDialog, AppDialogActions, AppDialogContent, SectionLabel } from "../../../components/common/AppDialog";
import { useCep } from "../../../hooks/useCep";
import api from "../../../api/api";
import { maskCpf, maskTelefone, maskCep } from "../../../utils/masks";

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type Client = {
  id: string;
  nome: string;
  email?: string;
  cpf?: string;
  telefone?: string;
  data_nascimento?: string;
  observacao?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  cidade_id?: number | null;
  cidade?: { nome: string; uf: string } | null;
};

export type ClientForm = {
  nome: string;
  email?: string;
  cpf?: string;
  telefone?: string;
  data_nascimento?: string;
  observacao?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  cidade_id?: number | null;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Client | null;
  onClose: () => void;
  onSubmit: (data: ClientForm) => void;
  onDelete?: (client: Client) => void;
};

// ─── Validações ────────────────────────────────────────────────────────────

function isCPFValido(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(d[10]);
}

function isEmailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Componente principal ──────────────────────────────────────────────────

export default function ClientDialog({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
  onDelete,
}: Props) {
  const isEdit = mode === "edit";
  const { buscar, loading: cepLoading, erro: cepErro, setErro: setCepErro } = useCep();

  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [cpf, setCpf] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [dataNascimento, setDataNascimento] = React.useState("");
  const [observacao, setObservacao] = React.useState("");
  const [cep, setCep] = React.useState("");
  const [logradouro, setLogradouro] = React.useState("");
  const [numero, setNumero] = React.useState("");
  const [complemento, setComplemento] = React.useState("");
  const [cidadeId, setCidadeId] = React.useState<number | null>(null);
  const [cidadeNome, setCidadeNome] = React.useState("");
  const [uf, setUf] = React.useState("");

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // ── Inicial ──
  React.useEffect(() => {
    if (!open) return;
    setNome(initial?.nome ?? "");
    setEmail(initial?.email ?? "");
    setCpf(initial?.cpf ? maskCpf(initial.cpf) : "");
    setTelefone(initial?.telefone ? maskTelefone(initial.telefone) : "");
    setDataNascimento(initial?.data_nascimento ?? "");
    setObservacao(initial?.observacao ?? "");
    setCep(initial?.cep ?? "");
    setLogradouro(initial?.logradouro ?? "");
    setNumero(initial?.numero ?? "");
    setComplemento(initial?.complemento ?? "");
    setCidadeId(initial?.cidade_id ?? null);
    setCidadeNome(initial?.cidade?.nome ?? "");
    setUf(initial?.cidade?.uf ?? "");
    setErrors({});
    setSubmitAttempted(false);
    setConfirmDelete(false);
    setCepErro(null);
  }, [open, initial]);

  // ── Revalida em tempo real ──
  React.useEffect(() => {
    if (submitAttempted) validate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nome, email, cpf, telefone]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!nome.trim()) errs.nome = "Informe o nome do cliente";
    if (email && !isEmailValido(email)) errs.email = "E-mail inválido";
    if (cpf && !isCPFValido(cpf)) errs.cpf = "CPF inválido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCepChange = async (raw: string) => {
    setCep(raw);
    if (raw.length !== 8) return;
    const dados = await buscar(raw);
    if (!dados) return;
    setLogradouro(dados.logradouro);
    setCidadeNome(dados.cidade);
    setUf(dados.uf);
    try {
      const res = await api.post("/cidade", { nome: dados.cidade, uf: dados.uf });
      setCidadeId(res.data.id);
    } catch {
      setCidadeId(null);
    }
  };

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (!validate()) return;
    onSubmit({
      nome: nome.trim(),
      email: email.trim() || undefined,
      cpf: cpf.replace(/\D/g, "") || undefined,
      telefone: telefone.replace(/\D/g, "") || undefined,
      data_nascimento: dataNascimento || undefined,
      observacao: observacao.trim() || undefined,
      cep: cep || undefined,
      logradouro: logradouro || undefined,
      numero: numero || undefined,
      complemento: complemento || undefined,
      cidade_id: cidadeId,
    });
    onClose();
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      title={isEdit ? "Editar cliente" : "Novo cliente"}
      icon={<PersonRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <Grid container spacing={1.5}>
          <Grid size={12}>
            <SectionLabel>Informações gerais</SectionLabel>
          </Grid>

          {/* ── Informações principais ── */}
          <Grid size={12}>
            <TextField
              label="Nome completo *"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: João da Silva"
              size="small"
              fullWidth
              error={!!errors.nome}
              helperText={errors.nome}
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonRoundedIcon fontSize="small" color={errors.nome ? "error" : "action"} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Telefone / WhatsApp"
              value={telefone}
              onChange={(e) => setTelefone(maskTelefone(e.target.value))}
              placeholder="(48) 99999-9999"
              size="small"
              fullWidth
              inputProps={{ maxLength: 15 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneRoundedIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@email.com"
              size="small"
              fullWidth
              error={!!errors.email}
              helperText={errors.email}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailRoundedIcon fontSize="small" color={errors.email ? "error" : "action"} />
                  </InputAdornment>
                ),
                endAdornment:
                  email && isEmailValido(email) ? (
                    <InputAdornment position="end">
                      <CheckCircleOutlineRoundedIcon fontSize="small" color="success" />
                    </InputAdornment>
                  ) : undefined,
              }}
            />
          </Grid>

          {/* CPF + Data de nascimento */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="CPF"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              size="small"
              fullWidth
              error={!!errors.cpf}
              helperText={errors.cpf}
              inputProps={{ maxLength: 14 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BadgeRoundedIcon fontSize="small" color={errors.cpf ? "error" : "action"} />
                  </InputAdornment>
                ),
                endAdornment:
                  cpf && isCPFValido(cpf) ? (
                    <InputAdornment position="end">
                      <CheckCircleOutlineRoundedIcon fontSize="small" color="success" />
                    </InputAdornment>
                  ) : undefined,
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Data de nascimento"
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarTodayRoundedIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={12}>
            <SectionLabel>Endereço</SectionLabel>
          </Grid>

          {/* linha 1: CEP / Nº / Complemento / Logradouro */}
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              label="CEP"
              value={maskCep(cep)}
              size="small"
              fullWidth
              error={!!cepErro}
              helperText={cepErro}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
                handleCepChange(raw);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {cepLoading
                      ? <CircularProgress size={14} />
                      : <FmdGoodRoundedIcon fontSize="small" color="action" />}
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 6, sm: 2 }}>
            <TextField
              label="Número"
              value={numero}
              size="small"
              fullWidth
              onChange={(e) => setNumero(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <NumbersRoundedIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              label="Complemento"
              value={complemento}
              size="small"
              fullWidth
              onChange={(e) => setComplemento(e.target.value)}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Logradouro"
              value={logradouro}
              size="small"
              fullWidth
              onChange={(e) => setLogradouro(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PlaceRoundedIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          {/* linha 2: Cidade / UF */}
          <Grid size={{ xs: 12, sm: 9 }}>
            <TextField
              label="Cidade"
              value={cidadeNome}
              size="small"
              fullWidth
              disabled
              error={cep.length === 8 && !cidadeNome}
              helperText={cep.length === 8 && !cidadeNome ? "CEP não encontrou a cidade" : undefined}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LocationCityRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              label="UF"
              value={uf}
              size="small"
              fullWidth
              disabled
              inputProps={{ maxLength: 2 }}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              label="Observações"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Preferências, histórico, informações relevantes..."
              size="small"
              fullWidth
              multiline
              rows={2}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start" sx={{ alignSelf: "flex-start", mt: 1 }}>
                    <NotesRoundedIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
        </Grid>

        {/* ── Alerta de erros ── */}
        <Collapse in={submitAttempted && Object.keys(errors).length > 0}>
          <Alert severity="error" sx={{ mt: 0.5, borderRadius: 2 }}>
            Corrija os campos destacados antes de salvar.
          </Alert>
        </Collapse>
      </AppDialogContent>

      <AppDialogActions sx={{ justifyContent: "space-between" }}>
        <Box>
          {isEdit && onDelete && initial && (
            <>
              {!confirmDelete ? (
                <Button
                  color="error"
                  startIcon={<DeleteOutlineRoundedIcon />}
                  onClick={() => setConfirmDelete(true)}
                  sx={{ borderRadius: 999 }}
                >
                  Excluir cliente
                </Button>
              ) : (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="error" fontWeight={600}>
                    Confirmar exclusão?
                  </Typography>
                  <Button
                    color="error"
                    variant="contained"
                    size="small"
                    disableElevation
                    onClick={() => onDelete(initial)}
                    sx={{ borderRadius: 999 }}
                  >
                    Sim, excluir
                  </Button>
                  <Button size="small" onClick={() => setConfirmDelete(false)} sx={{ borderRadius: 999 }}>
                    Cancelar
                  </Button>
                </Stack>
              )}
            </>
          )}
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 999 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disableElevation
            sx={{ borderRadius: 999, fontWeight: 700 }}
          >
            {isEdit ? "Salvar alterações" : "Cadastrar cliente"}
          </Button>
        </Stack>
      </AppDialogActions>
    </AppDialog>
  );
}
