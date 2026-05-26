import React, { useState } from "react";
import {
  Dialog, Box, Typography, IconButton, DialogContent, DialogActions,
  TextField, Button, CircularProgress, Alert,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import api from "../../../api/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: (admin: any) => void;
};

const EMPTY = { nome: "", email: "", senha: "" };

export function CriarAdminDialog({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/admins", form);
      onSuccess(data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Erro ao criar administrador.");
    } finally {
      setLoading(false);
    }
  }

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
              type="password"
              value={form.senha}
              onChange={(e) => set("senha", e.target.value)}
              required
              fullWidth
              helperText="Mín. 8 caracteres com maiúscula, minúscula, número e caractere especial"
              inputProps={{ minLength: 8 }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={16} color="inherit" /> : "Criar"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
