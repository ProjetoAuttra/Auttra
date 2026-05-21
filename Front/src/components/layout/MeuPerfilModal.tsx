import * as React from "react";
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import { useAuth } from "../../context/AuthContext";

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

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={{ xs: 0.4, sm: 2 }}
      sx={{ py: 1.35 }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ width: { sm: 140 }, flexShrink: 0, fontWeight: 700 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" color="text.primary" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
        {value || "-"}
      </Typography>
    </Stack>
  );
}

export default function MeuPerfilModal({ open, onClose, onChangePassword }: Props) {
  const { user } = useAuth();

  const nomeUsuario = user?.nome || "Usuario";
  const avatarLetter = nomeUsuario[0]?.toUpperCase() || "U";
  const perfilLabel =
    user?.perfilAcessoNome ??
    CARGO_LABEL[(user?.tipo ?? "").toLowerCase()] ??
    user?.tipo ??
    "Usuario";
  const empresaLabel = user?.oficina_nome?.trim() || "Empresa nao informada";

  const handleChangePassword = () => {
    onClose();
    onChangePassword();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 2.5, overflow: "hidden" } }}
    >
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
        <Stack direction="row" spacing={1.75} alignItems="center" minWidth={0}>
          <Box
            sx={(t) => ({
              width: 44,
              height: 44,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(t.palette.primary.main, 0.15),
              color: "primary.main",
              flexShrink: 0,
            })}
          >
            <PersonRoundedIcon />
          </Box>
          <Box minWidth={0}>
            <Typography variant="subtitle1" fontWeight={800} lineHeight={1.3} noWrap>
              Meu perfil
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              Informacoes da sua conta
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} size="small">
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: 3, py: 3 }}>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ width: 64, height: 64, fontSize: 26, fontWeight: 800, bgcolor: "primary.main" }}>
              {avatarLetter}
            </Avatar>
            <Box minWidth={0}>
              <Typography variant="h6" fontWeight={800} noWrap>
                {nomeUsuario}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {perfilLabel}
              </Typography>
            </Box>
          </Stack>

          <Box
            sx={{
              border: (t) => `1px solid ${t.palette.divider}`,
              borderRadius: 2,
              px: 2,
              py: 0.5,
              bgcolor: "background.paper",
            }}
          >
            <InfoRow label="Nome completo" value={nomeUsuario} />
            <Divider sx={{ opacity: 0.6 }} />
            <InfoRow label="E-mail" value={user?.email} />
            <Divider sx={{ opacity: 0.6 }} />
            <InfoRow label="Perfil de acesso" value={perfilLabel} />
            <Divider sx={{ opacity: 0.6 }} />
            <InfoRow label="Empresa" value={empresaLabel} />
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          borderTop: (t) => `1px solid ${t.palette.divider}`,
          bgcolor: (t) => alpha(t.palette.background.default, 0.65),
        }}
      >
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 999 }}>
          Fechar
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
      </DialogActions>
    </Dialog>
  );
}
