import { Button, Grid, InputAdornment, TextField } from "@mui/material";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { useAuth } from "../../context/AuthContext";
import { AppDialog, AppDialogActions, AppDialogContent, SectionLabel } from "../common/AppDialog";

const CARGO_LABEL: Record<string, string> = {
  administrador: "Administrador",
  gestoroficina: "Gestor",
  gerente: "Gerente",
  atendente: "Atendente",
  mecanico: "Mecanico",
  funcionario: "Funcionario",
  cliente: "Cliente",
  sistema: "Sistema",
};

type Props = {
  open: boolean;
  onClose: () => void;
  onChangePassword: () => void;
};

export default function MeuPerfilModal({ open, onClose, onChangePassword }: Props) {
  const { user } = useAuth();

  const nomeUsuario = user?.nome || "Usuario";
  const perfilLabel =
    user?.perfilAcessoNome ??
    CARGO_LABEL[(user?.tipo ?? "").toLowerCase()] ??
    user?.tipo ??
    "Usuario";

  const handleChangePassword = () => {
    onClose();
    onChangePassword();
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      title="Meu perfil"
    >
      <AppDialogContent>
        <SectionLabel>Informações gerais</SectionLabel>
        <Grid container spacing={2}>
          <Grid size={12}>
            <TextField
              label="Nome completo"
              fullWidth
              value={nomeUsuario}
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <BadgeRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              label="E-mail"
              fullWidth
              value={user?.email ?? ""}
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={12}>
            <TextField label="Perfil de acesso" fullWidth value={perfilLabel} InputProps={{ readOnly: true }} />
          </Grid>
        </Grid>
      </AppDialogContent>

      <AppDialogActions>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 999 }}>
          Cancelar
        </Button>
        <Button
          onClick={handleChangePassword}
          variant="contained"
          startIcon={<LockRoundedIcon />}
          disableElevation
          sx={{ borderRadius: 999, fontWeight: 700 }}
        >
          Trocar senha
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}
