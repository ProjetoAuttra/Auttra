import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogActions,
  Box, TextField, Typography, Button, CircularProgress, Divider, IconButton, Alert,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import api from "../../../api/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: (oficina: any) => void;
};

const EMPTY = {
  nome: "", logradouro: "", numero: "", cep: "", cidade: "", uf: "",
  complemento: "", telefone: "", email: "",
  gestor_nome: "", gestor_email: "", gestor_senha: "",
};

export function CriarOficinaDialog({ open, onClose, onSuccess }: Props) {
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
      const { data } = await api.post("/oficinas", {
        oficina: {
          nome: form.nome, logradouro: form.logradouro, numero: form.numero,
          cep: form.cep, cidade: form.cidade, uf: form.uf,
          complemento: form.complemento || undefined,
          telefone: form.telefone || undefined,
          email: form.email || undefined,
        },
        gestor: { nome: form.gestor_nome, email: form.gestor_email, senha: form.gestor_senha },
      });
      onSuccess({ id: data.oficina.id, nome: data.oficina.nome, cidade: form.cidade + "/" + form.uf, total_usuarios: 1, total_os_abertas: 0, criada_em: new Date().toISOString() });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Erro ao criar oficina.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="subtitle1">Nova oficina</Typography>
        <IconButton size="small" onClick={handleClose}><CloseRoundedIcon fontSize="small" /></IconButton>
      </Box>

      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 2.5 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Typography sx={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", mb: 1.5 }}>
            Dados da oficina
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField label="Nome da oficina" value={form.nome} onChange={(e) => set("nome", e.target.value)} required fullWidth />
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label="Logradouro" value={form.logradouro} onChange={(e) => set("logradouro", e.target.value)} required fullWidth />
              <TextField label="Número" value={form.numero} onChange={(e) => set("numero", e.target.value)} required sx={{ width: 120 }} />
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label="CEP" value={form.cep} onChange={(e) => set("cep", e.target.value)} required sx={{ width: 140 }} />
              <TextField label="Cidade" value={form.cidade} onChange={(e) => set("cidade", e.target.value)} required fullWidth />
              <TextField label="UF" value={form.uf} onChange={(e) => set("uf", e.target.value.toUpperCase())} required sx={{ width: 80 }} inputProps={{ maxLength: 2 }} />
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label="Complemento" value={form.complemento} onChange={(e) => set("complemento", e.target.value)} fullWidth />
              <TextField label="Telefone" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} fullWidth />
            </Box>
            <TextField label="E-mail da oficina" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} fullWidth />
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography sx={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", mb: 1.5 }}>
            Gestor (proprietário)
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField label="Nome do gestor" value={form.gestor_nome} onChange={(e) => set("gestor_nome", e.target.value)} required fullWidth />
            <TextField label="E-mail do gestor" type="email" value={form.gestor_email} onChange={(e) => set("gestor_email", e.target.value)} required fullWidth />
            <TextField label="Senha inicial" type="password" value={form.gestor_senha} onChange={(e) => set("gestor_senha", e.target.value)} required fullWidth />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={16} color="inherit" /> : "Criar oficina"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
