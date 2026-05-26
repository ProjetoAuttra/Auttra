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
  onSuccess: (oficina?: any) => void;
};

const EMPTY = {
  nome: "", cnpj: "", logradouro: "", numero: "", cep: "", cidade: "", uf: "",
  complemento: "", telefone: "", email: "",
  gestor_nome: "", gestor_email: "", gestor_senha: "",
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function maskCep(value: string) {
  return onlyDigits(value).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

function maskCnpj(value: string) {
  return onlyDigits(value).slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export function CriarOficinaDialog({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field: keyof typeof EMPTY, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  function handleClose() {
    setForm(EMPTY);
    setError("");
    onClose();
  }

  async function buscarCep(value: string) {
    const cep = onlyDigits(value);
    set("cep", maskCep(value));
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          cep: maskCep(cep),
          logradouro: data.logradouro || prev.logradouro,
          cidade: data.localidade || prev.cidade,
          uf: data.uf || prev.uf,
        }));
      }
    } catch {
      // Busca de CEP é auxiliar; o cadastro manual continua disponível.
    } finally {
      setCepLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/oficinas", {
        oficina: {
          nome: form.nome,
          cnpj: form.cnpj || undefined,
          logradouro: form.logradouro,
          numero: form.numero,
          cep: form.cep,
          cidade: form.cidade,
          uf: form.uf,
          complemento: form.complemento || undefined,
          telefone: form.telefone || undefined,
          email: form.email || undefined,
        },
        gestor: { nome: form.gestor_nome, email: form.gestor_email, senha: form.gestor_senha },
      });
      onSuccess(data.oficina);
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
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label="Nome da oficina" value={form.nome} onChange={(e) => set("nome", e.target.value)} required fullWidth />
              <TextField label="CNPJ" value={form.cnpj} onChange={(e) => set("cnpj", maskCnpj(e.target.value))} sx={{ width: 190 }} />
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label="Logradouro" value={form.logradouro} onChange={(e) => set("logradouro", e.target.value)} required fullWidth />
              <TextField label="Número" value={form.numero} onChange={(e) => set("numero", e.target.value)} required sx={{ width: 120 }} />
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label="CEP" value={form.cep} onChange={(e) => buscarCep(e.target.value)} required sx={{ width: 140 }} helperText={cepLoading ? "Buscando..." : undefined} />
              <TextField label="Cidade" value={form.cidade} onChange={(e) => set("cidade", e.target.value)} required fullWidth />
              <TextField label="UF" value={form.uf} onChange={(e) => set("uf", e.target.value.toUpperCase().slice(0, 2))} required sx={{ width: 80 }} inputProps={{ maxLength: 2 }} />
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label="Complemento" value={form.complemento} onChange={(e) => set("complemento", e.target.value)} fullWidth />
              <TextField label="Telefone" value={form.telefone} onChange={(e) => set("telefone", maskPhone(e.target.value))} fullWidth />
            </Box>
            <TextField label="E-mail da oficina" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} fullWidth />
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography sx={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", mb: 1.5 }}>
            Gestor proprietário
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
