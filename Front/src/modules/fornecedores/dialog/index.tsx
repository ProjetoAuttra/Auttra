import * as React from "react";
import {
  Box, Stack, TextField,
  Button, Typography, Grid, InputAdornment, CircularProgress,
} from "@mui/material";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import NumbersRoundedIcon from "@mui/icons-material/NumbersRounded";
import LocationCityRoundedIcon from "@mui/icons-material/LocationCityRounded";
import FmdGoodRoundedIcon from "@mui/icons-material/FmdGoodRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { useCep } from "../../../hooks/useCep";
import api from "../../../api/api";
import { maskCep } from "../../../utils/masks";
import { AppDialog, AppDialogActions, AppDialogContent, SectionLabel } from "../../../components/common/AppDialog";

export type Supplier = {
  id: string;
  nome: string;
  contato?: string;
  telefone?: string;
  email?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  cep?: string;
  cidade_id?: number | null;
  cidade?: { nome: string; uf: string } | null;
  created_at: string;
};

export type SupplierForm = {
  nome: string;
  contato?: string;
  telefone?: string;
  email?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  cep?: string;
  cidade_id?: number | null;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Supplier | null;
  onClose: () => void;
  onSubmit: (data: SupplierForm) => Promise<void>;
  onDelete?: (supplier: Supplier) => void;
};

export default function SupplierDialog({ open, mode, initial, onClose, onSubmit, onDelete }: Props) {
  const isEdit = mode === "edit";
  const { buscar, loading: cepLoading, erro: cepErro, setErro: setCepErro } = useCep();

  const [form, setForm] = React.useState<SupplierForm>({
    nome: "", contato: "", telefone: "", email: "",
    logradouro: "", numero: "", complemento: "", cep: "", cidade_id: null,
  });
  const [cidadeNome, setCidadeNome] = React.useState("");
  const [uf, setUf] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setForm({
      nome: initial?.nome ?? "",
      contato: initial?.contato ?? "",
      telefone: initial?.telefone ?? "",
      email: initial?.email ?? "",
      logradouro: initial?.logradouro ?? "",
      numero: initial?.numero ?? "",
      complemento: initial?.complemento ?? "",
      cep: initial?.cep ?? "",
      cidade_id: initial?.cidade_id ?? null,
    });
    setCidadeNome(initial?.cidade?.nome ?? "");
    setUf(initial?.cidade?.uf ?? "");
    setConfirmDelete(false);
    setCepErro(null);
  }, [open, initial]);

  const handleChange = (field: keyof SupplierForm, value: string | number | null) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleCepChange = async (raw: string) => {
    handleChange("cep", raw);
    if (raw.length !== 8) return;
    const dados = await buscar(raw);
    if (!dados) return;
    handleChange("logradouro", dados.logradouro);
    setCidadeNome(dados.cidade);
    setUf(dados.uf);
    try {
      const res = await api.post("/cidade", { nome: dados.cidade, uf: dados.uf });
      handleChange("cidade_id", res.data.id);
    } catch {
      handleChange("cidade_id", null);
    }
  };

  const handleSubmit = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      title={isEdit ? "Editar fornecedor" : "Novo fornecedor"}
      icon={<BusinessRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <Grid container spacing={1.5}>
          <Grid size={12}>
            <SectionLabel>Dados básicos</SectionLabel>
          </Grid>

          <Grid size={12}>
            <TextField
              label="Nome do fornecedor *"
              value={form.nome}
              onChange={(e) => handleChange("nome", e.target.value)}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BusinessRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Contato"
              value={form.contato}
              onChange={(e) => handleChange("contato", e.target.value)}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Telefone"
              value={form.telefone}
              onChange={(e) => handleChange("telefone", e.target.value)}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              label="E-mail"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              size="small"
              fullWidth
              type="email"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={12}>
            <SectionLabel>Endereço</SectionLabel>
          </Grid>

          {/* Linha 1: CEP / Nº / Complemento / Logradouro */}
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              label="CEP"
              value={maskCep(form.cep ?? "")}
              size="small"
              fullWidth
              error={!!cepErro}
              helperText={cepErro ?? undefined}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
                handleCepChange(raw);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {cepLoading
                      ? <CircularProgress size={14} />
                      : <FmdGoodRoundedIcon fontSize="small" />}
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 6, sm: 2 }}>
            <TextField
              label="Número"
              value={form.numero}
              onChange={(e) => handleChange("numero", e.target.value)}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <NumbersRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField
              label="Complemento"
              value={form.complemento}
              onChange={(e) => handleChange("complemento", e.target.value)}
              size="small"
              fullWidth
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Logradouro"
              value={form.logradouro}
              onChange={(e) => handleChange("logradouro", e.target.value)}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PlaceRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          {/* Linha 2: Cidade / UF */}
          <Grid size={{ xs: 12, sm: 9 }}>
            <TextField
              label="Cidade"
              value={cidadeNome}
              size="small"
              fullWidth
              disabled
              helperText={cidadeNome ? undefined : "Preenchido automaticamente pelo CEP"}
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
        </Grid>
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
                  Excluir fornecedor
                </Button>
              ) : (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="error" fontWeight={600}>Confirmar exclusão?</Typography>
                  <Button
                    color="error" variant="contained" size="small" disableElevation
                    onClick={() => { onDelete(initial); onClose(); }}
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
            onClick={handleSubmit}
            variant="contained"
            disableElevation
            disabled={saving}
            sx={{ borderRadius: 999, fontWeight: 700 }}
          >
            {saving ? <CircularProgress size={18} /> : (isEdit ? "Salvar alterações" : "Cadastrar fornecedor")}
          </Button>
        </Stack>
      </AppDialogActions>
    </AppDialog>
  );
}
