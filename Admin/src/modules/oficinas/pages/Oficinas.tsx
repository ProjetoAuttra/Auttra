import React, { useEffect, useState } from "react";
import {
  Box, Typography, Button, Paper, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, IconButton, Menu, MenuItem,
  Chip, Skeleton, TextField, InputAdornment,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { useNavigate } from "react-router-dom";
import api from "../../../api/api";
import { CriarOficinaDialog } from "../dialog/CriarOficina";
import { useToast } from "../../../context/ToastContext";
import { useConfirm } from "../../../context/ConfirmContext";

type Gestor = { id: number; nome: string; email: string };

type Oficina = {
  id: number;
  nome: string;
  cnpj: string | null;
  cidade: string | null;
  telefone: string | null;
  email: string | null;
  gestor: Gestor | null;
  total_usuarios: number;
  total_os_abertas: number;
  criada_em: string;
  deleted_at?: string | null;
};

export function OficinasPage() {
  const [rows, setRows] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [criarOpen, setCriarOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; id: number } | null>(null);
  const { success, error } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  function load() {
    setLoading(true);
    api.get<Oficina[]>("/oficinas")
      .then((r) => setRows(r.data))
      .catch(() => error("Erro ao carregar oficinas."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleDesativar(id: number) {
    const ok = await confirm({ title: "Desativar oficina?", message: "Todos os vínculos de usuários desta oficina serão suspensos.", confirmLabel: "Desativar" });
    if (!ok) return;
    try {
      await api.delete(`/oficinas/${id}`);
      setRows((prev) => prev.filter((o) => o.id !== id));
      success("Oficina desativada.");
    } catch {
      error("Erro ao desativar oficina.");
    }
    setMenuAnchor(null);
  }

  async function handleReativar(id: number) {
    try {
      await api.post(`/oficinas/${id}/reativar`);
      load();
      success("Oficina reativada.");
    } catch {
      error("Erro ao reativar oficina.");
    }
    setMenuAnchor(null);
  }

  const filtered = rows.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.nome.toLowerCase().includes(q) ||
      (o.cnpj ?? "").toLowerCase().includes(q) ||
      (o.telefone ?? "").toLowerCase().includes(q) ||
      (o.email ?? "").toLowerCase().includes(q) ||
      (o.gestor?.nome ?? "").toLowerCase().includes(q) ||
      (o.gestor?.email ?? "").toLowerCase().includes(q)
    );
  });

  const selectedOficina = rows.find((o) => o.id === menuAnchor?.id);

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Oficinas</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {rows.length} oficina{rows.length !== 1 ? "s" : ""} cadastrada{rows.length !== 1 ? "s" : ""}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          <TextField
            size="small"
            placeholder="Buscar por nome, CNPJ, telefone, e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 320 }}
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
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setCriarOpen(true)}
          >
            Nova oficina
          </Button>
        </Box>
      </Box>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Oficina</TableCell>
                <TableCell>CNPJ</TableCell>
                <TableCell>Cidade</TableCell>
                <TableCell>Gestor</TableCell>
                <TableCell align="center">Usuários</TableCell>
                <TableCell>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}><Skeleton variant="text" /></TableCell>
                    ))}
                  </TableRow>
                ))
                : filtered.map((row) => (
                  <TableRow
                    key={row.id}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => navigate(`/oficinas/${row.id}`)}
                  >
                    <TableCell sx={{ fontWeight: 500 }}>{row.nome}</TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{row.cnpj ?? "—"}</TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{row.cidade ?? "—"}</TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{row.gestor?.nome ?? "—"}</TableCell>
                    <TableCell align="center">{row.total_usuarios}</TableCell>
                    <TableCell>
                      <Chip
                        label={row.deleted_at ? "Inativa" : "Ativa"}
                        size="small"
                        sx={{
                          bgcolor: row.deleted_at ? "#fef2f2" : "#f0fdf4",
                          color: row.deleted_at ? "#dc2626" : "#16a34a",
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
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: "text.secondary", fontSize: 14 }}>
                    {search ? "Nenhuma oficina encontrada para esta busca." : "Nenhuma oficina cadastrada."}
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
        <MenuItem onClick={() => { navigate(`/oficinas/${menuAnchor!.id}`); setMenuAnchor(null); }}>
          Ver detalhes
        </MenuItem>
        {selectedOficina?.deleted_at
          ? <MenuItem onClick={() => handleReativar(menuAnchor!.id)}>Reativar</MenuItem>
          : <MenuItem onClick={() => handleDesativar(menuAnchor!.id)} sx={{ color: "error.main" }}>Desativar</MenuItem>
        }
      </Menu>

      <CriarOficinaDialog
        open={criarOpen}
        onClose={() => setCriarOpen(false)}
        onSuccess={(nova) => { setRows((prev) => [nova, ...prev]); setCriarOpen(false); success("Oficina criada com sucesso."); }}
      />
    </Box>
  );
}
