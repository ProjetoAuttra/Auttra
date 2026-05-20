import * as React from "react";
import {
  Dialog, DialogContent, DialogActions, Stack, TextField,
  Button, IconButton, Typography, Paper, Grid, InputAdornment,
  CircularProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import NumbersRoundedIcon from "@mui/icons-material/NumbersRounded";
import LocationCityRoundedIcon from "@mui/icons-material/LocationCityRounded";
import LocalPostOfficeRoundedIcon from "@mui/icons-material/LocalPostOfficeRounded";
import { useCep } from "../../../hooks/useCep";
import api from "../../../api/api";

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
  onSubmit: (data: SupplierForm) => void;
  onDelete?: (supplier: Supplier) => void;
};

const formatCep = (v: string) =>
  v.length <= 5 ? v : v.slice(0, 5) + "-" + v.slice(5, 8);

export default function SupplierDialog({ open, mode, initial, onClose, onSubmit, onDelete }: Props) {
  const { buscar, loading: cepLoading, erro: cepErro, setErro: setCepErro } = useCep();

  const [form, setForm] = React.useState<SupplierForm>({
    nome: "", contato: "", telefone: "", email: "",
    logradouro: "", numero: "", complemento: "", cep: "", cidade_id: null,
  });

  // Campos de exibição — preenchidos pelo CEP, não salvos diretamente
  const [cidadeNome, setCidadeNome] = React.useState("");
  const [uf, setUf] = React.useState("");

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

  const handleSubmit = () => {
    if (!form.nome.trim()) return;
    onSubmit(form);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}>

      <Paper elevation={0} square sx={{
        px: 3, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between",
        bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
      }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <HeaderIcon><BusinessRoundedIcon /></HeaderIcon>
          <Stack spacing={0}>
            <Typography variant="subtitle1" fontWeight={800}>
              {mode === "create" ? "Novo fornecedor" : "Editar fornecedor"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Preencha os dados do fornecedor abaixo
            </Typography>
          </Stack>
        </Stack>
        <IconButton onClick={onClose} size="small"><CloseRoundedIcon /></IconButton>
      </Paper>

      <DialogContent sx={{ px: 4, pt: 2, pb: 1 }}>
        <Grid container spacing={2}>

          {/* Dados básicos */}
          <Grid item xs={12}>
            <TextField label="Nome do fornecedor" value={form.nome} required size="small" fullWidth
              onChange={(e) => handleChange("nome", e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><BusinessRoundedIcon fontSize="small" /></InputAdornment> }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField label="Contato" value={form.contato} size="small" fullWidth
              onChange={(e) => handleChange("contato", e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><PersonRoundedIcon fontSize="small" /></InputAdornment> }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField label="Telefone" value={form.telefone} size="small" fullWidth
              onChange={(e) => handleChange("telefone", e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><PhoneRoundedIcon fontSize="small" /></InputAdornment> }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField label="E-mail" value={form.email} size="small" fullWidth type="email"
              onChange={(e) => handleChange("email", e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><EmailRoundedIcon fontSize="small" /></InputAdornment> }}
            />
          </Grid>

          {/* Endereço */}
          <Grid item xs={5} md={4}>
            <TextField
              label="CEP"
              value={formatCep(form.cep ?? "")}
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
                      : <LocalPostOfficeRoundedIcon fontSize="small" />}
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={3} md={2}>
            <TextField label="Número" value={form.numero} size="small" fullWidth
              onChange={(e) => handleChange("numero", e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><NumbersRoundedIcon fontSize="small" /></InputAdornment> }}
            />
          </Grid>

          <Grid item xs={4} md={6}>
            <TextField label="Complemento" value={form.complemento} size="small" fullWidth
              onChange={(e) => handleChange("complemento", e.target.value)}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField label="Logradouro" value={form.logradouro} size="small" fullWidth
              onChange={(e) => handleChange("logradouro", e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><PlaceRoundedIcon fontSize="small" /></InputAdornment> }}
            />
          </Grid>

          <Grid item xs={9}>
            <TextField
              label="Cidade"
              value={cidadeNome}
              size="small"
              fullWidth
              disabled
              helperText={cidadeNome ? undefined : "Preenchido automaticamente pelo CEP"}
              InputProps={{ startAdornment: <InputAdornment position="start"><LocationCityRoundedIcon fontSize="small" /></InputAdornment> }}
            />
          </Grid>

          <Grid item xs={3}>
            <TextField label="UF" value={uf} size="small" fullWidth disabled
              inputProps={{ maxLength: 2 }}
            />
          </Grid>

        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {mode === "edit" && onDelete && initial?.id && (
          <Button color="error" onClick={() => { onDelete(initial!); onClose(); }}>
            Excluir
          </Button>
        )}
        <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
          <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 999 }}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained" sx={{ borderRadius: 999 }}>Salvar</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

function HeaderIcon({ children }: { children: React.ReactNode }) {
  return (
    <Stack sx={{
      width: 36, height: 36, borderRadius: "50%",
      display: "grid", placeItems: "center",
      bgcolor: (t) => alpha(t.palette.primary.main, 0.15),
      color: "primary.main", flexShrink: 0,
    }}>
      {children}
    </Stack>
  );
}
