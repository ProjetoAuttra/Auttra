import React, { useState } from "react";
import {
  Dialog, Box, Typography, IconButton, DialogContent, DialogActions,
  TextField, Button, CircularProgress, Alert, InputAdornment,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import api from "../../../api/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: (admin: any) => void;
};

const EMPTY = { nome: "", email: "", senha: "", confirmarSenha: "" };

export function CriarAdminDialog({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);

  function set(field: keyof typeof EMPTY, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  function handleClose() {
    setForm(EMPTY);
    setError("");
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.senha !== form.confirmarSenha) {
      setError("As senhas não coincidem.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/admins", { nome: form.nome, email: form.email, senha: form.senha });
      onSuccess(data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Erro ao criar administrador.");
    } finally {
      setLoading(false);
    }
  }

  const senhasMismatch = form.confirmarSenha.length > 0 && form.senha !== form.confirmarSenha;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="subtitle1">Novo administrador</Typography>
        <IconButton size="small" onClick={handleClose}><CloseRoundedIcon fontSize="small" /></IconButton>
      </Box>

      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 2.5 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField label="Nome" value={form.nome} onChange={(e) => set("nome", e.target.value)} required fullWidth autoFocus />
            <TextField label="E-mail" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required fullWidth />
            <TextField
              label="Senha"
              type={showSenha ? "text" : "password"}
              value={form.senha}
              onChange={(e) => set("senha", e.target.value)}
              required fullWidth
              helperText="Mín. 8 caracteres com maiúscula, minúscula, número e caractere especial"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowSenha((v) => !v)} edge="end">
                        {showSenha ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="Confirmar senha"
              type={showConfirmar ? "text" : "password"}
              value={form.confirmarSenha}
              onChange={(e) => set("confirmarSenha", e.target.value)}
              required fullWidth
              error={senhasMismatch}
              helperText={senhasMismatch ? "As senhas não coincidem" : undefined}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowConfirmar((v) => !v)} edge="end">
                        {showConfirmar ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={loading || senhasMismatch}>
            {loading ? <CircularProgress size={16} color="inherit" /> : "Criar"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
