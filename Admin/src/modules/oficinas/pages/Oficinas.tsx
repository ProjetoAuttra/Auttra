import React, { useEffect, useState } from "react";
import {
  Box, Typography, Button, Paper, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, IconButton, Menu, MenuItem,
  Chip, Skeleton, TextField, InputAdornment, TablePagination, FormControl,
  InputLabel, Select,
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
  status_admin?: string;
  criada_em: string;
  deleted_at?: string | null;
};

type OficinasResponse = {
  data: Oficina[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const statusLabels: Record<string, string> = {
  ativas: "Ativas",
  inativas: "Inativas",
  todas: "Todas",
  implantacao: "Implantação",
  ativa: "Ativa",
  suspensa: "Suspensa",
  cancelada: "Cancelada",
};

export function OficinasPage() {
  const [rows, setRows] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("ativas");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [criarOpen, setCriarOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; id: number } | null>(null);
  const { success, error } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  function load() {
    setLoading(true);
    api.get<OficinasResponse>("/oficinas", {
      params: { q: debouncedSearch || undefined, status, page: page + 1, pageSize },
    })
      .then((r) => {
        setRows(r.data.data);
        setTotal(r.data.total);
      })
      .catch(() => error("Erro ao carregar oficinas."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [debouncedSearch, status, page, pageSize]);

  async function handleDesativar(id: number) {
    const ok = await confirm({ title: "Desativar oficina?", message: "Todos os vínculos de usuários desta oficina serão suspensos.", confirmLabel: "Desativar" });
    if (!ok) return;
    try {
      await api.delete(`/oficinas/${id}`);
      load();
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

  const selectedOficina = rows.find((o) => o.id === menuAnchor?.id);

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Oficinas</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {total} oficina{total !== 1 ? "s" : ""} encontrada{total !== 1 ? "s" : ""}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          <TextField
            size="small"
            placeholder="Buscar por nome, CNPJ, telefone, e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: { xs: "100%", sm: 320 } }}
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
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
              {Object.entries(statusLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCriarOpen(true)}>
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
                <TableCell align="center">OS abertas</TableCell>
                <TableCell>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}><Skeleton variant="text" /></TableCell>
                    ))}
                  </TableRow>
                ))
                : rows.map((row) => (
                  <TableRow key={row.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/oficinas/${row.id}`)}>
                    <TableCell sx={{ fontWeight: 500 }}>{row.nome}</TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{row.cnpj ?? "—"}</TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{row.cidade ?? "—"}</TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{row.gestor?.nome ?? "—"}</TableCell>
                    <TableCell align="center">{row.total_usuarios}</TableCell>
                    <TableCell align="center">{row.total_os_abertas}</TableCell>
                    <TableCell>
                      <Chip
                        label={row.deleted_at ? "Inativa" : statusLabels[row.status_admin ?? "ativa"] ?? "Ativa"}
                        size="small"
                        sx={{
                          bgcolor: row.deleted_at ? "#fef2f2" : row.status_admin === "implantacao" ? "#fffbeb" : "#f0fdf4",
                          color: row.deleted_at ? "#dc2626" : row.status_admin === "implantacao" ? "#b45309" : "#16a34a",
                          fontWeight: 600, fontSize: 11,
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setMenuAnchor({ el: e.currentTarget, id: row.id }); }}>
                        <MoreVertRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              }
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6, color: "text.secondary", fontSize: 14 }}>
                    {debouncedSearch ? "Nenhuma oficina encontrada para esta busca." : "Nenhuma oficina cadastrada."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50]}
          labelRowsPerPage="Linhas por página"
        />
      </Paper>

      <Menu anchorEl={menuAnchor?.el} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
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
        onSuccess={() => { setCriarOpen(false); setPage(0); load(); success("Oficina criada com sucesso."); }}
      />
    </Box>
  );
}
