import * as React from "react";
import {
  Grid, TextField, Button,
  MenuItem, InputAdornment, CircularProgress,
} from "@mui/material";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import PhoneIphoneRoundedIcon from "@mui/icons-material/PhoneIphoneRounded";
import WorkRoundedIcon from "@mui/icons-material/WorkRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import { useToast } from "../../../context/ToastContext";
import { listarPerfisAcesso, type PerfilAcesso } from "../../configuracoes/api/perfisAcesso";
import { maskTelefone } from "../../../utils/masks";
import { AppDialog, AppDialogActions, AppDialogContent, SectionLabel } from "../../../components/common/AppDialog";

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

export default function FuncionarioDialog({ open, mode = "create", initial, onClose, onSubmit, oficina_id }: Props) {
  const { warning } = useToast();
  const isEdit = mode === "edit";

  const [form, setForm] = React.useState<FuncionarioForm>({
    nome: "", email: "", telefone: "", cargo: "Mecanico",
    senha: "", data_contratacao: new Date().toISOString(), oficina_id,
  });
  const [perfis, setPerfis] = React.useState<PerfilAcesso[]>([]);
  const [saving, setSaving] = React.useState(false);

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
    <AppDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      title={isEdit ? "Editar funcionário" : "Novo funcionário"}
      icon={<PersonRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <Grid container spacing={1.5}>
          <Grid size={12}>
            <SectionLabel>Dados pessoais</SectionLabel>
          </Grid>

          <Grid size={12}>
            <TextField
              label="Nome completo *"
              fullWidth
              size="small"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 7 }}>
            <TextField
              label="E-mail *"
              fullWidth
              size="small"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 5 }}>
            <TextField
              label="Telefone *"
              fullWidth
              size="small"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: maskTelefone(e.target.value) })}
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
            <SectionLabel>Acesso ao sistema</SectionLabel>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              select
              label="Cargo"
              fullWidth
              size="small"
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <WorkRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            >
              {cargos.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              select
              label="Perfil de acesso"
              fullWidth
              size="small"
              value={form.perfil_acesso_id ?? ""}
              onChange={(e) => setForm({ ...form, perfil_acesso_id: Number(e.target.value) })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <WorkRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            >
              {perfis.map((perfil) => <MenuItem key={perfil.id} value={perfil.id}>{perfil.nome}</MenuItem>)}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, sm: 7 }}>
            <TextField
              label={isEdit ? "Nova senha (opcional)" : "Senha de acesso *"}
              fullWidth
              size="small"
              type="password"
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              placeholder={isEdit ? "Deixe em branco para não alterar" : ""}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 5 }}>
            <TextField
              label="Data de contratação"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={form.data_contratacao.split("T")[0]}
              onChange={(e) => setForm({ ...form, data_contratacao: new Date(e.target.value).toISOString() })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarMonthRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
        </Grid>
      </AppDialogContent>

      <AppDialogActions>
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
          {saving ? <CircularProgress size={18} /> : (isEdit ? "Salvar alterações" : "Cadastrar funcionário")}
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}
