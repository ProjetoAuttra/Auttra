import React, { useEffect, useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, IconButton, Menu, MenuItem, Chip, Skeleton, Button,
  Grid, Dialog, DialogContent, DialogActions, TextField, CircularProgress, Alert,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../../api/api";
import { TrocarEmailDialog } from "../../usuarios/dialog/TrocarEmail";
import { useToast } from "../../../context/ToastContext";
import { useConfirm } from "../../../context/ConfirmContext";

type OficinaDetalhe = {
  id: number;
  nome: string;
  cnpj: string | null;
  logradouro: string;
  numero: string;
  complemento: string | null;
  cep: string;
  telefone: string | null;
  email: string | null;
  cidade: { nome: string; uf: string };
  gestor: { id: number; nome: string; email: string } | null;
  acessos: {
    id: number;
    perfil: string;
    status: string;
    usuario: { id: number; nome: string; email: string; tipo: string; status: string };
  }[];
};

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.25 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 14 }}>{value || "—"}</Typography>
    </Box>
  );
}

export function OficinaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error } = useToast();
  const confirm = useConfirm();

  const [oficina, setOficina] = useState<OficinaDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; usuarioId: number } | null>(null);
  const [trocarEmailId, setTrocarEmailId] = useState<number | null>(null);
  const [senhaDialog, setSenhaDialog] = useState<{ senha: string; email: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ logradouro: "", numero: "", cep: "", complemento: "", telefone: "", email: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editErr, setEditErr] = useState("");

  useEffect(() => {
    api.get<OficinaDetalhe>(`/oficinas/${id}`)
      .then((r) => {
        setOficina(r.data);
        setEditForm({
          logradouro: r.data.logradouro ?? "",
          numero: r.data.numero ?? "",
          cep: r.data.cep ?? "",
          complemento: r.data.complemento ?? "",
          telefone: r.data.telefone ?? "",
          email: r.data.email ?? "",
        });
      })
      .catch(() => { error("Erro ao carregar oficina."); navigate("/oficinas"); })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleResetSenha(usuarioId: number) {
    const usuario = oficina?.acessos.find((a) => a.usuario.id === usuarioId)?.usuario;
    const ok = await confirm({
      title: "Resetar senha?",
      message: `Uma senha aleatória de 8 caracteres será gerada para ${usuario?.nome}. A senha aparecerá na tela para você copiar.`,
      confirmLabel: "Gerar nova senha",
    });
    if (!ok) return;
    try {
      const { data } = await api.post(`/usuarios/${usuarioId}/reset-senha`);
      navigator.clipboard.writeText(data.senha_temporaria).catch(() => {});
      setSenhaDialog({ senha: data.senha_temporaria, email: usuario?.email ?? "" });
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      error("Erro ao resetar senha.");
    }
    setMenuAnchor(null);
  }

  function handleCopiar(senha: string) {
    navigator.clipboard.writeText(senha).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  }

  async function handleSalvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    setEditErr("");
    setEditLoading(true);
    try {
      await api.patch(`/oficinas/${id}`, editForm);
      setOficina((prev) => prev ? { ...prev, ...editForm } : prev);
      setEditOpen(false);
      success("Oficina atualizada com sucesso.");
    } catch (err: any) {
      setEditErr(err?.response?.data?.message ?? "Erro ao salvar alterações.");
    } finally {
      setEditLoading(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Skeleton variant="text" width={200} height={32} />
        <Skeleton variant="rectangular" height={160} sx={{ mt: 2, borderRadius: 1 }} />
      </Box>
    );
  }

  if (!oficina) return null;

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <IconButton size="small" onClick={() => navigate("/oficinas")}>
            <ArrowBackRoundedIcon fontSize="small" />
          </IconButton>
          <Box>
            <Typography variant="h6" fontWeight={700}>{oficina.nome}</Typography>
            <Typography variant="body2" color="text.secondary">
              {oficina.cidade.nome}/{oficina.cidade.uf}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<EditRoundedIcon />}
          onClick={() => setEditOpen(true)}
        >
          Editar
        </Button>
      </Box>

      {/* Info card */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", mb: 2 }}>
          Dados da oficina
        </Typography>
        <Grid container spacing={3}>
          <Grid size={3}><InfoRow label="CNPJ" value={oficina.cnpj} /></Grid>
          <Grid size={3}><InfoRow label="Telefone" value={oficina.telefone} /></Grid>
          <Grid size={3}><InfoRow label="E-mail" value={oficina.email} /></Grid>
          <Grid size={3}><InfoRow label="CEP" value={oficina.cep} /></Grid>
          <Grid size={6}>
            <InfoRow label="Endereço" value={`${oficina.logradouro}, ${oficina.numero}${oficina.complemento ? ` — ${oficina.complemento}` : ""}`} />
          </Grid>
          <Grid size={3}><InfoRow label="Gestor" value={oficina.gestor?.nome} /></Grid>
          <Grid size={3}><InfoRow label="E-mail do gestor" value={oficina.gestor?.email} /></Grid>
        </Grid>
      </Paper>

      {/* Users */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Usuários ({oficina.acessos.length})
        </Typography>
      </Box>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>E-mail</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {oficina.acessos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5, color: "text.secondary", fontSize: 14 }}>
                    Nenhum usuário vinculado a esta oficina.
                  </TableCell>
                </TableRow>
              ) : (
                oficina.acessos.map((acesso) => (
                  <TableRow key={acesso.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{acesso.usuario.nome}</TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{acesso.usuario.email}</TableCell>
                    <TableCell>
                      <Chip label={acesso.usuario.tipo} size="small" sx={{ bgcolor: "#f3f4f6", color: "#374151", fontSize: 11, fontWeight: 500 }} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={acesso.usuario.status === "ativo" ? "Ativo" : "Inativo"}
                        size="small"
                        sx={{
                          bgcolor: acesso.usuario.status === "ativo" ? "#f0fdf4" : "#f9fafb",
                          color: acesso.usuario.status === "ativo" ? "#16a34a" : "#6b7280",
                          fontWeight: 600, fontSize: 11,
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); setMenuAnchor({ el: e.currentTarget, usuarioId: acesso.usuario.id }); }}
                      >
                        <MoreVertRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Menu anchorEl={menuAnchor?.el} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => { setTrocarEmailId(menuAnchor!.usuarioId); setMenuAnchor(null); }}>
          Trocar e-mail
        </MenuItem>
        <MenuItem onClick={() => handleResetSenha(menuAnchor!.usuarioId)} sx={{ color: "text.secondary" }}>
          Resetar senha
        </MenuItem>
      </Menu>

      <TrocarEmailDialog
        open={trocarEmailId !== null}
        usuarioId={trocarEmailId}
        onClose={() => setTrocarEmailId(null)}
        onSuccess={(uid, novoEmail) => {
          setOficina((prev) => prev ? {
            ...prev,
            acessos: prev.acessos.map((a) =>
              a.usuario.id === uid ? { ...a, usuario: { ...a.usuario, email: novoEmail } } : a
            ),
          } : prev);
          setTrocarEmailId(null);
          success("E-mail atualizado com sucesso.");
        }}
      />

      {/* Dialog: editar oficina */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle1">Editar oficina</Typography>
        </Box>
        <Box component="form" onSubmit={handleSalvarEdicao}>
          <DialogContent sx={{ pt: 2.5 }}>
            {editErr && <Alert severity="error" sx={{ mb: 2 }}>{editErr}</Alert>}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box sx={{ display: "flex", gap: 2 }}>
                <TextField label="Logradouro" value={editForm.logradouro} onChange={(e) => setEditForm((p) => ({ ...p, logradouro: e.target.value }))} required fullWidth />
                <TextField label="Número" value={editForm.numero} onChange={(e) => setEditForm((p) => ({ ...p, numero: e.target.value }))} required sx={{ width: 120 }} />
              </Box>
              <Box sx={{ display: "flex", gap: 2 }}>
                <TextField label="CEP" value={editForm.cep} onChange={(e) => setEditForm((p) => ({ ...p, cep: e.target.value }))} required sx={{ width: 140 }} />
                <TextField label="Complemento" value={editForm.complemento} onChange={(e) => setEditForm((p) => ({ ...p, complemento: e.target.value }))} fullWidth />
              </Box>
              <Box sx={{ display: "flex", gap: 2 }}>
                <TextField label="Telefone" value={editForm.telefone} onChange={(e) => setEditForm((p) => ({ ...p, telefone: e.target.value }))} fullWidth />
                <TextField label="E-mail da oficina" type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} fullWidth />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button onClick={() => setEditOpen(false)} disabled={editLoading}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={editLoading}>
              {editLoading ? <CircularProgress size={16} color="inherit" /> : "Salvar"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Dialog: senha gerada */}
      <Dialog open={Boolean(senhaDialog)} onClose={() => setSenhaDialog(null)} maxWidth="xs" fullWidth>
        <Box sx={{ px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle1">Senha gerada</Typography>
        </Box>
        <DialogContent sx={{ pt: 2.5 }}>
          <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
            Nova senha temporária para <strong>{senhaDialog?.email}</strong>. O usuário deve trocá-la no próximo acesso.
          </Typography>
          <Box sx={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            bgcolor: "#f9fafb", border: "1px solid", borderColor: "divider",
            borderRadius: 1, px: 2, py: 1.5,
          }}>
            <Typography sx={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, letterSpacing: "0.12em" }}>
              {senhaDialog?.senha}
            </Typography>
            <IconButton size="small" onClick={() => handleCopiar(senhaDialog!.senha)}>
              <ContentCopyRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
          {copiado && (
            <Typography sx={{ fontSize: 12, color: "success.main", mt: 1 }}>
              Copiado para a área de transferência!
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => handleCopiar(senhaDialog!.senha)}>
            {copiado ? "Copiado!" : "Copiar novamente"}
          </Button>
          <Button variant="contained" onClick={() => setSenhaDialog(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
