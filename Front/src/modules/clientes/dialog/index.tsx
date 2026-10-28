import * as React from "react";
import {
  Stack,
  TextField,
  Button,
  InputAdornment,
  Collapse,
  Alert,
  Box,
  CircularProgress,
  Typography,
} from "@mui/material";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { AppDrawer, DrawerSection } from "../../../components/common/AppDrawer";
import CampoData from "../../../components/common/CampoData";
import { useCep } from "../../../hooks/useCep";
import api from "../../../api/api";
import { maskCpf, maskCnpj, maskTelefone, maskCep } from "../../../utils/masks";

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

function isCNPJValido(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;

  const calc = (base: string, weights: number[]) => {
    const sum = weights.reduce((acc, weight, index) => acc + Number(base[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const digit1 = calc(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const digit2 = calc(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digit1 === Number(d[12]) && digit2 === Number(d[13]);
}

function maskCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length > 11 ? maskCnpj(digits) : maskCpf(digits);
}

function isDocumentoValido(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (!digits) return true;
  if (digits.length === 11) return isCPFValido(digits);
  if (digits.length === 14) return isCNPJValido(digits);
  return false;
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
    setCpf(initial?.cpf ? maskCpfCnpj(initial.cpf) : "");
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
    if (cpf && !isDocumentoValido(cpf)) errs.cpf = "CPF/CNPJ inválido";
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

  const check = (ok: boolean) =>
    ok ? (
      <InputAdornment position="end">
        <CheckCircleOutlineRoundedIcon fontSize="small" color="success" />
      </InputAdornment>
    ) : undefined;
  const linha = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 } as const;

  const footer = (
    <>
      <Box>
        {isEdit && onDelete && initial && (
          !confirmDelete ? (
            <Button color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => setConfirmDelete(true)}>
              Excluir cliente
            </Button>
          ) : (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="error" fontWeight={600}>Confirmar exclusão?</Typography>
              <Button color="error" variant="contained" size="small" disableElevation onClick={() => onDelete(initial)}>
                Sim, excluir
              </Button>
              <Button size="small" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            </Stack>
          )
        )}
      </Box>
      <Stack direction="row" spacing={1.5}>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit} disableElevation sx={{ fontWeight: 700 }}>
          {isEdit ? "Salvar alterações" : "Cadastrar cliente"}
        </Button>
      </Stack>
    </>
  );

  return (
    <AppDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar cliente" : "Novo cliente"}
      subtitle={isEdit ? initial?.nome : "Cadastre os dados de contato e o endereço"}
      icon={<PersonRoundedIcon />}
      footer={footer}
    >
      <DrawerSection title="Dados do cliente">
        <Stack spacing={2}>
          <TextField
            label="Nome / Razão social *"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            size="small"
            fullWidth
            error={!!errors.nome}
            helperText={errors.nome}
            autoFocus
          />
          <Box sx={linha}>
            <TextField
              label="Telefone / WhatsApp"
              value={telefone}
              onChange={(e) => setTelefone(maskTelefone(e.target.value))}
              size="small"
              fullWidth
              inputProps={{ maxLength: 15 }}
            />
            <TextField
              label="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              size="small"
              fullWidth
              error={!!errors.email}
              helperText={errors.email}
              InputProps={{ endAdornment: check(!!email && isEmailValido(email)) }}
            />
          </Box>
          <Box sx={linha}>
            <TextField
              label="CPF/CNPJ"
              value={cpf}
              onChange={(e) => setCpf(maskCpfCnpj(e.target.value))}
              size="small"
              fullWidth
              error={!!errors.cpf}
              helperText={errors.cpf}
              inputProps={{ maxLength: 18 }}
              InputProps={{ endAdornment: check(!!cpf && isDocumentoValido(cpf)) }}
            />
            <CampoData label="Nascimento / Fundação" value={dataNascimento} onChange={setDataNascimento} />
          </Box>
        </Stack>
      </DrawerSection>

      <DrawerSection title="Endereço">
        <Stack spacing={2}>
          <Box sx={linha}>
            <TextField
              label="CEP"
              value={maskCep(cep)}
              size="small"
              fullWidth
              error={!!cepErro}
              helperText={cepErro}
              onChange={(e) => handleCepChange(e.target.value.replace(/\D/g, "").slice(0, 8))}
              InputProps={{ endAdornment: cepLoading ? <InputAdornment position="end"><CircularProgress size={14} /></InputAdornment> : undefined }}
            />
            <TextField label="Número" value={numero} size="small" fullWidth onChange={(e) => setNumero(e.target.value)} />
          </Box>
          <TextField label="Logradouro" value={logradouro} size="small" fullWidth onChange={(e) => setLogradouro(e.target.value)} />
          <TextField label="Complemento" value={complemento} size="small" fullWidth onChange={(e) => setComplemento(e.target.value)} />
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 2 }}>
            <TextField
              label="Cidade"
              value={cidadeNome}
              size="small"
              fullWidth
              disabled
              error={cep.length === 8 && !cidadeNome}
              helperText={cep.length === 8 && !cidadeNome ? "CEP não encontrou a cidade" : undefined}
            />
            <TextField label="UF" value={uf} size="small" fullWidth disabled inputProps={{ maxLength: 2 }} />
          </Box>
        </Stack>
      </DrawerSection>

      <DrawerSection title="Observações">
        <TextField
          placeholder="Anotações sobre o cliente"
          inputProps={{ "aria-label": "Observações" }}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          size="small"
          fullWidth
          multiline
          rows={3}
        />
      </DrawerSection>

      <Collapse in={submitAttempted && Object.keys(errors).length > 0}>
        <Alert severity="error" sx={{ mt: 3, borderRadius: 1.5 }}>
          Corrija os campos destacados antes de salvar.
        </Alert>
      </Collapse>
    </AppDrawer>
  );
}
