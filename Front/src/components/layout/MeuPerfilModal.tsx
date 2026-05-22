import * as React from "react";
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CameraAltRoundedIcon from "@mui/icons-material/CameraAltRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/api";

function resizeToBase64(file: File, size = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

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
  const { user, updateCurrentUser } = useAuth();

  const nomeUsuario = user?.nome || "Usuario";
  const avatarLetter = nomeUsuario[0]?.toUpperCase() || "U";
  const perfilLabel =
    user?.perfilAcessoNome ??
    CARGO_LABEL[(user?.tipo ?? "").toLowerCase()] ??
    user?.tipo ??
    "Usuario";
  const empresaLabel = user?.oficina_nome?.trim() || "Empresa nao informada";

  const [uploading, setUploading] = React.useState(false);
  const [hovering, setHovering] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const avatarUrl = user?.foto_url ?? null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return;
    setUploading(true);
    try {
      const b64 = await resizeToBase64(file);
      await api.patch("/auth/me/foto", { foto_url: b64 });
      updateCurrentUser({ foto_url: b64 });
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
    e.target.value = "";
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      await api.patch("/auth/me/foto", { foto_url: null });
      updateCurrentUser({ foto_url: null });
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
  };

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
            {/* Avatar clicável */}
            <Box sx={{ position: "relative", flexShrink: 0 }}>
              <Tooltip title="Alterar foto">
                <Avatar
                  src={avatarUrl ?? undefined}
                  onClick={() => fileRef.current?.click()}
                  onMouseEnter={() => setHovering(true)}
                  onMouseLeave={() => setHovering(false)}
                  sx={{
                    width: 72,
                    height: 72,
                    fontSize: 28,
                    fontWeight: 800,
                    bgcolor: "primary.main",
                    cursor: "pointer",
                    transition: "filter 0.15s",
                    filter: hovering ? "brightness(0.75)" : "none",
                  }}
                >
                  {avatarLetter}
                </Avatar>
              </Tooltip>
              <Box
                onClick={uploading ? undefined : () => fileRef.current?.click()}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
                sx={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: uploading || hovering ? 1 : 0,
                  transition: "opacity 0.15s",
                  cursor: uploading ? "default" : "pointer",
                }}
              >
                {uploading
                  ? <CircularProgress size={24} sx={{ color: "#fff" }} />
                  : <CameraAltRoundedIcon sx={{ color: "#fff", fontSize: 22 }} />
                }
              </Box>
              {avatarUrl && (
                <Tooltip title="Remover foto">
                  <IconButton
                    size="small"
                    onClick={handleRemove}
                    sx={{
                      position: "absolute",
                      bottom: -4,
                      right: -4,
                      width: 22,
                      height: 22,
                      bgcolor: "error.main",
                      color: "#fff",
                      "&:hover": { bgcolor: "error.dark" },
                    }}
                  >
                    <DeleteRoundedIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Tooltip>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </Box>

            <Box minWidth={0}>
              <Typography variant="h6" fontWeight={800} noWrap>
                {nomeUsuario}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {perfilLabel}
              </Typography>
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ mt: 0.5, display: "block", cursor: "pointer", "&:hover": { color: "primary.main" } }}
                onClick={() => fileRef.current?.click()}
              >
                Clique na foto para alterar
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
