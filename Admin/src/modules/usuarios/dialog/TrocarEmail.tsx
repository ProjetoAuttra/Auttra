import React, { useState } from "react";
import {
  Dialog, Box, Typography, IconButton, DialogContent, DialogActions,
  TextField, Button, CircularProgress, Alert,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import api from "../../../api/api";

type Props = {
  open: boolean;
  usuarioId: number | null;
  onClose: () => void;
  onSuccess: (id: number, novoEmail: string) => void;
};

export function TrocarEmailDialog({ open, usuarioId, onClose, onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleClose() {
    setEmail("");
    setError("");
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioId) return;
    setError("");
    setLoading(true);
    try {
      await api.patch(`/usuarios/${usuarioId}/email`, { email });
      onSuccess(usuarioId, email);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Erro ao atualizar e-mail.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="subtitle1">Trocar e-mail</Typography>
        <IconButton size="small" onClick={handleClose}><CloseRoundedIcon fontSize="small" /></IconButton>
      </Box>

      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 2.5 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            label="Novo e-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={16} color="inherit" /> : "Salvar"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
