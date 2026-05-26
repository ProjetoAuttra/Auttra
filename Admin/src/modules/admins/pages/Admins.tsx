import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Typography, Button, Paper, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, IconButton, Menu, MenuItem,
  Chip, Skeleton, TextField, InputAdornment, ToggleButtonGroup, ToggleButton,
  TablePagination,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import api from "../../../api/api";
import { CriarAdminDialog } from "../dialog/CriarAdmin";
import { useToast } from "../../../context/ToastContext";
import { useConfirm } from "../../../context/ConfirmContext";
import { useAuth } from "../../../context/AuthContext";

type Admin = {
  id: number;
  nome: string;
  email: string;
  status: string;
  created_at: string;
  last_login_at?: string | null;
  last_login_ip?: string | null;
};

type FiltroStatus = "ativos" | "inativos" | "todos";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function AdminsPage() {
  const [rows, setRows] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [criarOpen, setCriarOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; id: number } | null>(null);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("ativos");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const { success, error } = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();

  function load() {
    setLoading(true);
    api.get<Admin[]>("/admins")
      .then((r) => setRows(r.data))
      .catch(() => error("Erro ao carregar administradores."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleDesativar(id: number) {
    const admin = rows.find((a) => a.id === id);
    const ok = await confirm({
      title: "Desativar administrador?",
      message: `${admin?.nome} não conseguirá mais acessar o painel.`,
      confirmLabel: "Desativar",
    });
    if (!ok) return;
    try {
      await api.patch(`/admins/${id}/desativar`);
      setRows((prev) => prev.map((a) => a.id === id ? { ...a, status: "inativo" } : a));
      success("Administrador desativado.");
    } catch (err: any) {
      error(err?.response?.data?.message ?? "Erro ao desativar.");
    }
    setMenuAnchor(null);
  }

  async function handleReativar(id: number) {
    try {
      await api.patch(`/admins/${id}/reativar`);
      setRows((prev) => prev.map((a) => a.id === id ? { ...a, status: "ativo" } : a));
      success("Administrador reativado.");
    } catch (err: any) {
      error(err?.response?.data?.message ?? "Erro ao reativar.");
    }
    setMenuAnchor(null);
  }

  const ativos = rows.filter((a) => a.status === "ativo").length;
  const inativos = rows.filter((a) => a.status === "inativo").length;

  const filtered = useMemo(() => rows.filter((a) => {
    const statusOk = filtroStatus === "todos" || a.status === (filtroStatus === "ativos" ? "ativo" : "inativo");
    const q = search.toLowerCase();
    const searchOk = !q || a.nome.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
    return statusOk && searchOk;
  }), [rows, filtroStatus, search]);

  const paginated = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const selectedAdmin = rows.find((a) => a.id === menuAnchor?.id);

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Administradores</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Usuários com acesso ao painel admin. Limite: 2 ativos.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCriarOpen(true)} disabled={ativos >= 2}>
          Novo administrador
        </Button>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <ToggleButtonGroup value={filtroStatus} exclusive onChange={(_, v) => { if (v) { setFiltroStatus(v); setPage(0); } }} size="small">
          <ToggleButton value="ativos">Ativos ({ativos})</ToggleButton>
          <ToggleButton value="inativos">Inativos ({inativos})</ToggleButton>
          <ToggleButton value="todos">Todos ({rows.length})</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          size="small"
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
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
                <TableCell>Status</TableCell>
                <TableCell>Criado em</TableCell>
                <TableCell>Último acesso</TableCell>
                <TableCell>IP</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}><Skeleton variant="text" /></TableCell>
                    ))}
                  </TableRow>
                ))
                : paginated.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {row.nome}
                      {row.id === user?.id && <Chip label="você" size="small" sx={{ ml: 1, fontSize: 10, height: 18 }} />}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{row.email}</TableCell>
                    <TableCell>
                      <Chip label={row.status === "ativo" ? "Ativo" : "Inativo"} size="small" color={row.status === "ativo" ? "success" : "default"} />
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{formatDate(row.created_at)}</TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{formatDate(row.last_login_at)}</TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{row.last_login_ip ?? "—"}</TableCell>
                    <TableCell align="right">
                      {row.id !== user?.id && (
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setMenuAnchor({ el: e.currentTarget, id: row.id }); }}>
                          <MoreVertRoundedIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              }
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: "text.secondary", fontSize: 14 }}>
                    {search ? "Nenhum resultado para a busca." : "Nenhum administrador nesta categoria."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50]}
          labelRowsPerPage="Linhas por página"
        />
      </Paper>

      <Menu anchorEl={menuAnchor?.el} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        {selectedAdmin?.status === "ativo"
          ? <MenuItem onClick={() => handleDesativar(menuAnchor!.id)} sx={{ color: "error.main" }}>Desativar</MenuItem>
          : <MenuItem onClick={() => handleReativar(menuAnchor!.id)}>Reativar</MenuItem>
        }
      </Menu>

      <CriarAdminDialog open={criarOpen} onClose={() => setCriarOpen(false)} onSuccess={() => { setCriarOpen(false); load(); success("Administrador criado com sucesso."); }} />
    </Box>
  );
}
