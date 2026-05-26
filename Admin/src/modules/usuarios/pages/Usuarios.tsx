import React, { useEffect, useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, IconButton, Menu, MenuItem, Chip, Skeleton, TextField,
  InputAdornment, ToggleButtonGroup, ToggleButton, Dialog, DialogContent,
  DialogActions, Button,
} from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import api from "../../../api/api";
import { TrocarEmailDialog } from "../dialog/TrocarEmail";
import { useToast } from "../../../context/ToastContext";
import { useConfirm } from "../../../context/ConfirmContext";

type Usuario = {
  id: number;
  nome: string;
  email: string;
  tipo: string;
  status: string;
  acessos: { oficina: { id: number; nome: string } }[];
};

type FiltroTipo = "todos" | "funcionario" | "cliente" | "gestoroficina";

const TIPO_LABELS: Record<string, string> = {
  funcionario: "Funcionário",
  cliente: "Cliente",
  gestoroficina: "Gestor",
};

export function UsuariosPage() {
  const [rows, setRows] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; id: number } | null>(null);
  const [trocarEmailId, setTrocarEmailId] = useState<number | null>(null);
  const [senhaDialog, setSenhaDialog] = useState<{ senha: string; email: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const { success, error } = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    api.get<Usuario[]>("/usuarios")
      .then((r) => setRows(r.data))
      .catch(() => error("Erro ao carregar usuários."))
      .finally(() => setLoading(false));
  }, []);

  async function handleResetSenha(id: number) {
    const usuario = rows.find((u) => u.id === id);
    const ok = await confirm({
      title: "Resetar senha?",
      message: `Uma senha aleatória de 8 caracteres será gerada para ${usuario?.nome}. A senha aparecerá na tela para você copiar.`,
      confirmLabel: "Gerar nova senha",
    });
    if (!ok) return;
    try {
      const { data } = await api.post(`/usuarios/${id}/reset-senha`);
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

  const filtered = rows.filter((u) => {
    const tipoOk = filtroTipo === "todos" || u.tipo === filtroTipo;
    const searchOk = !search || u.nome.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return tipoOk && searchOk;
  });

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Usuários</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {rows.length} usuário{rows.length !== 1 ? "s" : ""} no sistema
          </Typography>
        </Box>
        <TextField
          size="small"
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 280 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      {/* Filtro por tipo */}
      <Box sx={{ mb: 2 }}>
        <ToggleButtonGroup
          value={filtroTipo}
          exclusive
          onChange={(_, v) => { if (v) setFiltroTipo(v); }}
          size="small"
        >
          <ToggleButton value="todos">Todos</ToggleButton>
          <ToggleButton value="gestoroficina">Gestores</ToggleButton>
          <ToggleButton value="funcionario">Funcionários</ToggleButton>
          <ToggleButton value="cliente">Clientes</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>E-mail</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Oficinas</TableCell>
                <TableCell>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}><Skeleton variant="text" /></TableCell>
                    ))}
                  </TableRow>
                ))
                : filtered.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{row.nome}</TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{row.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={TIPO_LABELS[row.tipo] ?? row.tipo}
                        size="small"
                        sx={{ bgcolor: "#f3f4f6", color: "#374151", fontSize: 11, fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>
                      {row.acessos?.map((a) => a.oficina?.nome).filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={row.status === "ativo" ? "Ativo" : "Inativo"}
                        size="small"
                        sx={{
                          bgcolor: row.status === "ativo" ? "#f0fdf4" : "#f9fafb",
                          color: row.status === "ativo" ? "#16a34a" : "#6b7280",
                          fontWeight: 600, fontSize: 11,
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); setMenuAnchor({ el: e.currentTarget, id: row.id }); }}
                      >
                        <MoreVertRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              }
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: "text.secondary", fontSize: 14 }}>
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Menu anchorEl={menuAnchor?.el} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => { setTrocarEmailId(menuAnchor!.id); setMenuAnchor(null); }}>
          Trocar e-mail
        </MenuItem>
        <MenuItem onClick={() => handleResetSenha(menuAnchor!.id)} sx={{ color: "text.secondary" }}>
          Resetar senha
        </MenuItem>
      </Menu>

      <TrocarEmailDialog
        open={trocarEmailId !== null}
        usuarioId={trocarEmailId}
        onClose={() => setTrocarEmailId(null)}
        onSuccess={(id, novoEmail) => {
          setRows((prev) => prev.map((u) => u.id === id ? { ...u, email: novoEmail } : u));
          setTrocarEmailId(null);
          success("E-mail atualizado com sucesso.");
        }}
      />

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
