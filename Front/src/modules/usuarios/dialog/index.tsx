import * as React from "react";
import {
  Dialog, DialogContent, DialogActions, Grid, TextField, Button,
  MenuItem, InputAdornment, Typography, Stack, Paper, IconButton, CircularProgress,
} from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import PhoneIphoneRoundedIcon from "@mui/icons-material/PhoneIphoneRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import { useToast } from "../../../context/ToastContext";
import { listarPerfisAcesso, type PerfilAcesso } from "../../configuracoes/api/perfisAcesso";
import { maskTelefone } from "../../../utils/masks";

const cargos = ["Mecanico", "Atendente", "Gerente", "Administrador"];


export type FuncionarioForm = {
  nome: string;
  email: string;
  telefone: string;
  cargo: string;
  senha: string;
  data_contratacao: string;
  oficina_id: number;
  perfil_acesso_id?: number;
};

type Props = {
  open: boolean;
  mode?: "create" | "edit";
  initial?: any;
  onClose: () => void;
  onSubmit: (data: FuncionarioForm) => Promise<void>;
  oficina_id: number;
};

const HeaderIcon = styled(Stack)(({ theme }) => ({
  width: 40,
  height: 40,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  backgroundColor: alpha(theme.palette.primary.main, 0.2),
  color: theme.palette.primary.main,
}));

export default function FuncionarioDialog({ open, mode = "create", initial, onClose, onSubmit, oficina_id }: Props) {
  const { warning } = useToast();
  const isEdit = mode === "edit";

  const [form, setForm] = React.useState<FuncionarioForm>({
    nome: "", email: "", telefone: "", cargo: "Mecanico",
    senha: "", data_contratacao: new Date().toISOString(), oficina_id,
  });
  const [perfis, setPerfis] = React.useState<PerfilAcesso[]>([]);

  React.useEffect(() => {
    if (!open) return;

    listarPerfisAcesso().then((data) => {
      setPerfis(data);

      if (isEdit && initial) {
        setForm({
          nome: initial.nome ?? "",
          email: initial.email ?? "",
          telefone: maskTelefone(initial.telefone ?? ""),
          cargo: initial.cargo ?? "Mecanico",
          senha: "",
          data_contratacao: initial.data_contratacao ?? new Date().toISOString(),
          oficina_id,
          perfil_acesso_id: initial.perfil_acesso_id,
        });
      } else {
        const recepcao = data.find((p) => p.chave === "recepcao") ?? data.find((p) => p.padrao) ?? data[0];
        setForm({
          nome: "", email: "", telefone: "", cargo: "Mecanico",
          senha: "", data_contratacao: new Date().toISOString(),
          oficina_id, perfil_acesso_id: recepcao?.id,
        });
      }
    }).catch(() => setPerfis([]));
  }, [open, oficina_id, isEdit, initial]);

  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async () => {
    if (!form.nome || !form.email || !form.telefone) {
      warning("Preencha todos os campos obrigatórios.");
      return;
    }
    if (!isEdit && (!form.senha || form.senha.length < 6)) {
      warning("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (isEdit && form.senha && form.senha.length < 6) {
      warning("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    const payload: FuncionarioForm = { ...form, data_contratacao: new Date().toISOString(), oficina_id };
    if (isEdit && !form.senha) delete (payload as any).senha;
    setSaving(true);
    try {
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 2, overflow: "hidden", boxShadow: (t) => `0 8px 32px ${alpha(t.palette.primary.main, 0.25)}` } }}>

      <Paper elevation={0} square sx={{ px: 3, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between", bgcolor: (t) => alpha(t.palette.primary.main, 0.08) }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <HeaderIcon><PersonRoundedIcon /></HeaderIcon>
          <Stack spacing={0}>
            <Typography variant="subtitle1" fontWeight={800}>{isEdit ? "Editar Funcionário" : "Novo Funcionário"}</Typography>
            <Typography variant="body2" color="text.secondary">
              {isEdit ? "Altere os dados do funcionário. Deixe a senha em branco para mantê-la." : "Preencha as informações do funcionário e do acesso ao sistema"}
            </Typography>
          </Stack>
        </Stack>
        <IconButton onClick={onClose} size="small"><CloseRoundedIcon /></IconButton>
      </Paper>

      <DialogContent sx={{ px: 4, pt: 3, pb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={12}>
            <TextField label="Nome completo" fullWidth value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              InputProps={{ startAdornment: <InputAdornment position="start"><PersonRoundedIcon fontSize="small" /></InputAdornment> }} />
          </Grid>
          <Grid size={12}>
            <TextField label="E-mail" fullWidth type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              InputProps={{ startAdornment: <InputAdornment position="start"><EmailRoundedIcon fontSize="small" /></InputAdornment> }} />
          </Grid>
          <Grid size={12}>
            <TextField label="Telefone" fullWidth value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: maskTelefone(e.target.value) })}
              placeholder="(XX) X XXXX-XXXX"
              inputProps={{ maxLength: 16 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><PhoneIphoneRoundedIcon fontSize="small" /></InputAdornment> }} />
          </Grid>
          <Grid size={12}>
            <TextField select label="Cargo" fullWidth value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              InputProps={{ startAdornment: <InputAdornment position="start"><WorkRoundedIcon fontSize="small" /></InputAdornment> }}>
              {cargos.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={12}>
            <TextField select label="Perfil de acesso" fullWidth value={form.perfil_acesso_id ?? ""}
              onChange={(e) => setForm({ ...form, perfil_acesso_id: Number(e.target.value) })}
              InputProps={{ startAdornment: <InputAdornment position="start"><WorkRoundedIcon fontSize="small" /></InputAdornment> }}>
              {perfis.map((perfil) => <MenuItem key={perfil.id} value={perfil.id}>{perfil.nome}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={12}>
            <TextField
              label={isEdit ? "Nova senha (opcional)" : "Senha de acesso"}
              fullWidth type="password" value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              placeholder={isEdit ? "Deixe em branco para não alterar" : ""}
              InputProps={{ startAdornment: <InputAdornment position="start"><LockRoundedIcon fontSize="small" /></InputAdornment> }} />
          </Grid>
          <Grid size={12}>
            <TextField label="Data de contratação" type="date" fullWidth InputLabelProps={{ shrink: true }}
              value={form.data_contratacao.split("T")[0]}
              onChange={(e) => setForm({ ...form, data_contratacao: new Date(e.target.value).toISOString() })}
              InputProps={{ startAdornment: <InputAdornment position="start"><CalendarMonthRoundedIcon fontSize="small" /></InputAdornment> }} />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 4, py: 2.5 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 999 }}>Cancelar</Button>
        <Button onClick={handleSubmit} variant="contained" disableElevation disabled={saving} sx={{ borderRadius: 999, fontWeight: 700 }}>
          {saving ? <CircularProgress size={18} /> : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
