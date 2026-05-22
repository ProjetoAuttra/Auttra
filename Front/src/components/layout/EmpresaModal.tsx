import * as React from "react";
import {
  Avatar,
  Dialog, DialogContent, DialogActions, Box, Stack, Typography,
  TextField, Button, Grid, InputAdornment, CircularProgress, Divider, IconButton,
  Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import PhoneIphoneRoundedIcon from "@mui/icons-material/PhoneIphoneRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import CameraAltRoundedIcon from "@mui/icons-material/CameraAltRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { buscarEmpresa, atualizarEmpresa, type EmpresaData } from "../../modules/configuracoes/api/empresa";
import { useCep } from "../../hooks/useCep";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { maskCnpj, maskTelefone, maskCep } from "../../utils/masks";

type Props = { open: boolean; onClose: () => void };

type Form = {
  nome: string;
  cnpj: string;
  email: string;
  telefone: string;
  logo_url: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  cidade: string;
  uf: string;
};


function empresaToForm(e: EmpresaData): Form {
  return {
    nome: e.nome ?? "",
    cnpj: maskCnpj(e.cnpj ?? ""),
    email: e.email ?? "",
    telefone: maskTelefone(e.telefone ?? ""),
    logo_url: e.logo_url ?? null,
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
  logo_url: null,
  cep: "", logradouro: "", numero: "", complemento: "", cidade: "", uf: "",
};

function resizeToBase64(file: File, size = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Nao foi possivel processar a imagem."));
        return;
      }
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.84));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nao foi possivel carregar a imagem."));
    };
    img.src = url;
  });
}

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
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

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

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      error("Escolha uma imagem de ate 5MB.");
      event.target.value = "";
      return;
    }

    setUploadingLogo(true);
    try {
      const logo = await resizeToBase64(file);
      setForm((prev) => ({ ...prev, logo_url: logo }));
    } catch {
      error("Nao foi possivel carregar a logo.");
    } finally {
      setUploadingLogo(false);
      event.target.value = "";
    }
  };

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
        logo_url: form.logo_url,
        cep: form.cep,
        logradouro: form.logradouro,
        numero: form.numero,
        complemento: form.complemento,
        cidade_nome: form.cidade,
        cidade_uf: form.uf,
      });
      updateCurrentUser({ oficina_nome: empresa.nome, oficina_logo_url: empresa.logo_url ?? null });
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
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: (t) => `1px solid ${t.palette.divider}`,
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.035),
                    }}
                  >
                    <Box sx={{ position: "relative", flexShrink: 0 }}>
                      <Tooltip title="Alterar logo">
                        <Avatar
                          variant="rounded"
                          src={form.logo_url ?? undefined}
                          onClick={() => fileRef.current?.click()}
                          sx={{
                            width: 76,
                            height: 76,
                            borderRadius: 2,
                            fontSize: 28,
                            fontWeight: 900,
                            bgcolor: "primary.main",
                            cursor: "pointer",
                          }}
                        >
                          {(form.nome || "D")[0].toUpperCase()}
                        </Avatar>
                      </Tooltip>

                      <Box
                        onClick={uploadingLogo ? undefined : () => fileRef.current?.click()}
                        sx={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: 2,
                          display: "grid",
                          placeItems: "center",
                          color: "#fff",
                          bgcolor: "rgba(0,0,0,0.34)",
                          opacity: uploadingLogo ? 1 : 0,
                          transition: "opacity 0.15s",
                          cursor: uploadingLogo ? "default" : "pointer",
                          "&:hover": { opacity: 1 },
                        }}
                      >
                        {uploadingLogo ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : <CameraAltRoundedIcon />}
                      </Box>

                      {form.logo_url && (
                        <Tooltip title="Remover logo">
                          <IconButton
                            size="small"
                            onClick={() => setForm((prev) => ({ ...prev, logo_url: null }))}
                            sx={{
                              position: "absolute",
                              right: -7,
                              bottom: -7,
                              width: 26,
                              height: 26,
                              bgcolor: "error.main",
                              color: "#fff",
                              "&:hover": { bgcolor: "error.dark" },
                            }}
                          >
                            <DeleteRoundedIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      )}

                      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleLogoChange} />
                    </Box>

                    <Box minWidth={0}>
                      <Typography variant="subtitle2" fontWeight={800}>
                        Logo da oficina
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>
                        Esta marca aparece no topo do sistema e ajuda a identificar a empresa ativa.
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => fileRef.current?.click()}
                        startIcon={<CameraAltRoundedIcon />}
                        sx={{ mt: 1.25, borderRadius: 999, fontWeight: 700 }}
                      >
                        Escolher imagem
                      </Button>
                    </Box>
                  </Stack>
                </Grid>

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
