import React, { useEffect, useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, IconButton, Menu, MenuItem, Chip, Skeleton, TextField,
  InputAdornment,
} from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
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

export function UsuariosPage() {
  const [rows, setRows] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; id: number } | null>(null);
  const [trocarEmailId, setTrocarEmailId] = useState<number | null>(null);
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
      message: `Uma senha temporária será enviada para ${usuario?.email}. O usuário precisará alterá-la no próximo acesso.`,
      confirmLabel: "Resetar e enviar",
    });
    if (!ok) return;
    try {
      const { data } = await api.post(`/usuarios/${id}/reset-senha`);
      success(data.message);
    } catch {
      error("Erro ao resetar senha.");
    }
    setMenuAnchor(null);
  }

  const filtered = rows.filter(
    (u) =>
      u.nome.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

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
                        label={row.tipo}
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

      <Menu
        anchorEl={menuAnchor?.el}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
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
    </Box>
  );
}
