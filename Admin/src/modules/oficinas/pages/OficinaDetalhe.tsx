import React, { useEffect, useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, IconButton, Menu, MenuItem, Chip, Skeleton, Button,
  Divider, Grid,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
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

  useEffect(() => {
    api.get<OficinaDetalhe>(`/oficinas/${id}`)
      .then((r) => setOficina(r.data))
      .catch(() => { error("Erro ao carregar oficina."); navigate("/oficinas"); })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleResetSenha(usuarioId: number) {
    const usuario = oficina?.acessos.find((a) => a.usuario.id === usuarioId)?.usuario;
    const ok = await confirm({
      title: "Resetar senha?",
      message: `Uma senha temporária será enviada para ${usuario?.email}. O usuário precisará alterá-la no próximo acesso.`,
      confirmLabel: "Resetar e enviar",
    });
    if (!ok) return;
    try {
      const { data } = await api.post(`/usuarios/${usuarioId}/reset-senha`);
      success(data.message);
    } catch {
      error("Erro ao resetar senha.");
    }
    setMenuAnchor(null);
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
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
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

      <Menu
        anchorEl={menuAnchor?.el}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
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
    </Box>
  );
}
