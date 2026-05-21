import * as React from "react";
import {
  Dialog, DialogContent, DialogActions, Box, Stack, Typography,
  TextField, Button, Grid, InputAdornment, CircularProgress, Divider, IconButton,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import PhoneIphoneRoundedIcon from "@mui/icons-material/PhoneIphoneRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { buscarEmpresa, atualizarEmpresa, type EmpresaData } from "../../modules/configuracoes/api/empresa";
import { useCep } from "../../hooks/useCep";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";

type Props = { open: boolean; onClose: () => void };

type Form = {
  nome: string;
  cnpj: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  cidade: string;
  uf: string;
};

function maskCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function maskTelefone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}

function maskCep(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function empresaToForm(e: EmpresaData): Form {
  return {
    nome: e.nome ?? "",
    cnpj: maskCnpj(e.cnpj ?? ""),
    email: e.email ?? "",
    telefone: maskTelefone(e.telefone ?? ""),
    cep: maskCep(e.cep ?? ""),
    logradouro: e.logradouro ?? "",
    numero: e.numero ?? "",
    complemento: e.complemento ?? "",
    cidade: e.cidade?.nome ?? "",
    uf: e.cidade?.uf ?? "",
  };
}

const EMPTY_FORM: Form = {
  nome: "", cnpj: "", email: "", telefone: "",
  cep: "", logradouro: "", numero: "", complemento: "", cidade: "", uf: "",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      fontWeight={700}
      color="text.secondary"
      sx={{ textTransform: "uppercase", letterSpacing: 0.8, display: "block", mb: 1.5 }}
    >
      {children}
    </Typography>
  );
}

export default function EmpresaModal({ open, onClose }: Props) {
  const { success, error } = useToast();
  const { updateCurrentUser } = useAuth();
  const { buscar: buscarCep, loading: loadingCep } = useCep();

  const [form, setForm] = React.useState<Form>(EMPTY_FORM);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    buscarEmpresa()
      .then((data) => setForm(empresaToForm(data)))
      .catch(() => error("Não foi possível carregar os dados da empresa."))
      .finally(() => setLoading(false));
  }, [open, error]);

  const set = (field: keyof Form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleCepBlur = async () => {
    const digits = form.cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    const dados = await buscarCep(digits);
    if (dados) {
      setForm((prev) => ({
        ...prev,
        logradouro: dados.logradouro || prev.logradouro,
        cidade: dados.cidade || prev.cidade,
        uf: dados.uf || prev.uf,
      }));
    }
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { error("O nome da empresa é obrigatório."); return; }
    setSaving(true);
    try {
      const empresa = await atualizarEmpresa({
        nome: form.nome,
        cnpj: form.cnpj,
        email: form.email,
        telefone: form.telefone,
        cep: form.cep,
        logradouro: form.logradouro,
        numero: form.numero,
        complemento: form.complemento,
        cidade_nome: form.cidade,
        cidade_uf: form.uf,
      });
      updateCurrentUser({ oficina_nome: empresa.nome });
      success("Dados da empresa atualizados com sucesso.");
      onClose();
    } catch (err: any) {
      error(err?.response?.data?.message ?? "Não foi possível salvar os dados da empresa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{ sx: { borderRadius: 2.5, overflow: "hidden" } }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <Box
        sx={{
          px: 3,
          py: 2.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
        }}
      >
        <Stack direction="row" spacing={1.75} alignItems="center">
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              bgcolor: (t) => alpha(t.palette.primary.main, 0.15),
              color: "primary.main",
            }}
          >
            <BusinessRoundedIcon />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} lineHeight={1.3}>
              Dados da Empresa
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Informações da sua oficina
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} size="small">
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: { xs: 2.5, sm: 3.5 }, py: 3 }}>
        {loading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={3.5}>
            {/* ── Informações gerais ─────────────────────────── */}
            <Box>
              <SectionLabel>Informações gerais</SectionLabel>
              <Grid container spacing={2}>
                <Grid size={12}>
                  <TextField
                    label="Nome da empresa"
                    fullWidth
                    required
                    value={form.nome}
                    onChange={(e) => set("nome", e.target.value)}
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
                    label="CNPJ"
                    fullWidth
                    value={form.cnpj}
                    onChange={(e) => set("cnpj", maskCnpj(e.target.value))}
                    placeholder="XX.XXX.XXX/XXXX-XX"
                    inputProps={{ maxLength: 18 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <BadgeRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Telefone"
                    fullWidth
                    value={form.telefone}
                    onChange={(e) => set("telefone", maskTelefone(e.target.value))}
                    placeholder="(XX) X XXXX-XXXX"
                    inputProps={{ maxLength: 16 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneIphoneRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid size={12}>
                  <TextField
                    label="E-mail"
                    fullWidth
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* ── Endereço ────────────────────────────────────── */}
            <Box>
              <SectionLabel>Endereço</SectionLabel>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="CEP"
                    fullWidth
                    value={form.cep}
                    onChange={(e) => set("cep", maskCep(e.target.value))}
                    onBlur={handleCepBlur}
                    placeholder="XXXXX-XXX"
                    inputProps={{ maxLength: 9 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          {loadingCep ? (
                            <CircularProgress size={16} />
                          ) : (
                            <SearchRoundedIcon fontSize="small" />
                          )}
                        </InputAdornment>
                      ),
                    }}
                    helperText="Preencha o CEP para buscar o endereço automaticamente"
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 8 }}>
                  <TextField
                    label="Logradouro"
                    fullWidth
                    value={form.logradouro}
                    onChange={(e) => set("logradouro", e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <HomeRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Número"
                    fullWidth
                    value={form.numero}
                    onChange={(e) => set("numero", e.target.value)}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 9 }}>
                  <TextField
                    label="Complemento"
                    fullWidth
                    value={form.complemento}
                    onChange={(e) => set("complemento", e.target.value)}
                    placeholder="Apto, sala, bloco..."
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 8 }}>
                  <TextField
                    label="Cidade"
                    fullWidth
                    value={form.cidade}
                    onChange={(e) => set("cidade", e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LocationOnRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="UF"
                    fullWidth
                    value={form.uf}
                    onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))}
                    inputProps={{ maxLength: 2 }}
                  />
                </Grid>
              </Grid>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 3.5,
          py: 2.5,
          borderTop: (t) => `1px solid ${t.palette.divider}`,
          bgcolor: (t) => alpha(t.palette.background.default, 0.6),
        }}
      >
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 999 }}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disableElevation
          disabled={saving || loading}
          sx={{ borderRadius: 999, fontWeight: 700, minWidth: 100 }}
        >
          {saving ? <CircularProgress size={18} /> : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
