import * as React from "react";
import {
  Box, Stack, Typography, TextField, Button, IconButton,
  Paper, Chip, Menu, MenuItem, Table, TableBody, TableCell,
  TableHead, TableRow, TablePagination, Fade, Divider, Select, FormControl,
  InputLabel, type SelectChangeEvent,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { useNavigate, useSearchParams } from "react-router-dom"; // ← useSearchParams adicionado
import { useToast } from "../../../context/ToastContext";
import { useConfirm } from "../../../context/ConfirmContext";
import api from "../../../api/api";
import { listarOrdens, excluirOrdem, criarOrdem, atualizarOrdem } from "../api/api";
import OrdemDialog from "../dialog";
import TableSkeleton from "../../../components/common/TableSkeleton";
import EmptyState from "../../../components/common/EmptyState";
import ListTableContainer from "../../../components/common/ListTableContainer";

// ─── Status config ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: "default" | "warning" | "info" | "success" | "error" }> = {
  aberta: { label: "Aberta", color: "warning" },
  em_andamento: { label: "Em andamento", color: "info" },
  concluida: { label: "Concluída", color: "success" },
  cancelada: { label: "Cancelada", color: "error" },
};

const STATUS_VALIDOS = Object.keys(STATUS_CONFIG);

type Ordem = {
  id: number;
  status?: string;
  data_abertura?: string;
  valor_total?: number | string | null;
  cliente?: { nome?: string | null };
  veiculo?: { modelo?: string | null; placa?: string | null };
  funcionario?: { id?: number; nome?: string | null };
};

type OrdemPayload = Record<string, unknown>;

// ─── Componente ─────────────────────────────────────────────────────────────

export default function OrdensPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { success, error } = useToast();
  const confirm = useConfirm();

  const [rows, setRows] = React.useState<Ordem[]>([]);
  const [funcionarios, setFuncionarios] = React.useState<{ id: number; nome: string }[]>([]);
  const [filtroFuncionario, setFiltroFuncionario] = React.useState("todos");
  const [filtroData, setFiltroData] = React.useState("");
  const [showFilters, setShowFilters] = React.useState(false);
  const [openDialog, setOpenDialog] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [current, setCurrent] = React.useState<Ordem | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [menuId, setMenuId] = React.useState<number | null>(null);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  // ── Lê o filtro de status da URL (?status=em_andamento) ──
  const statusParam = searchParams.get("status") ?? "todos";
  const initialStatus = STATUS_VALIDOS.includes(statusParam) ? statusParam : "todos";
  const [filtroStatus, setFiltroStatus] = React.useState(initialStatus);

  // Sincroniza se o usuário navegar para a mesma página com param diferente
  React.useEffect(() => {
    const s = searchParams.get("status") ?? "todos";
    setFiltroStatus(STATUS_VALIDOS.includes(s) ? s : "todos");
    setPage(0);
  }, [searchParams]);

  // ── Carrega ──
  React.useEffect(() => {
    Promise.all([
      listarOrdens(),
      api.get("/funcionarios").then((r) => r.data).catch(() => []),
    ]).then(([ordens, funcs]) => {
      setRows(ordens);
      if (Array.isArray(funcs)) setFuncionarios(funcs);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = () => { setMode("create"); setCurrent(null); setOpenDialog(true); };
  const handleEdit = (os: Ordem) => { setMode("edit"); setCurrent(os); setOpenDialog(true); };
  const handleMenuOpen = (e: React.MouseEvent<HTMLButtonElement>, id: number) => { setAnchorEl(e.currentTarget); setMenuId(id); };
  const handleMenuClose = () => { setAnchorEl(null); setMenuId(null); };

  const handleDelete = async () => {
    if (!menuId) return;
    const ok = await confirm({
      title: "Excluir ordem de serviço?",
      message: "Esta ação não pode ser desfeita.",
      confirmLabel: "Sim, excluir",
      variant: "danger",
    });
    if (!ok) { handleMenuClose(); return; }
    try {
      await excluirOrdem(menuId);
      setRows((p) => p.filter((x) => x.id !== menuId));
      success("Ordem excluída com sucesso.");
    } catch { error("Não foi possível excluir a ordem."); }
    finally { handleMenuClose(); }
  };

  const handleSubmit = async (data: OrdemPayload) => {
    try {
      if (mode === "create") {
        const nova = await criarOrdem(data);
        setRows((p) => [nova, ...p]);
        success("Ordem de serviço criada!");
      } else if (current) {
        const atualizada = await atualizarOrdem(current.id, data);
        setRows((p) => p.map((x) => (x.id === current.id ? atualizada : x)));
        success("Ordem atualizada com sucesso!");
      }
      setOpenDialog(false);
    } catch { error("Não foi possível salvar a ordem."); }
  };

  // ── Filtros ──
  const hasActiveFilters = filtroStatus !== "todos" || filtroFuncionario !== "todos" || !!filtroData;

  const filtered = React.useMemo(() => {
    return rows.filter((r) => {
      const matchStatus = filtroStatus === "todos" || r.status === filtroStatus;
      const matchFunc = filtroFuncionario === "todos" || String(r.funcionario?.id) === filtroFuncionario;
      const matchData = !filtroData || r.data_abertura?.startsWith(filtroData);
      return matchStatus && matchFunc && matchData;
    });
  }, [rows, filtroStatus, filtroFuncionario, filtroData]);

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const clearFilters = () => {
    setFiltroStatus("todos"); setFiltroFuncionario("todos"); setFiltroData(""); setPage(0);
  };

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>

      {/* ── Header ── */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Stack spacing={0.3}>
          <Typography variant="h5" fontWeight={700}>Ordens de Serviço</Typography>
          <Typography variant="body2" color="text.secondary">
            Gerencie as ordens cadastradas na sua oficina
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<TuneRoundedIcon />}
            onClick={() => setShowFilters((p) => !p)}
            sx={{
              borderRadius: 3, textTransform: "none", fontWeight: 650,
              borderColor: (hasActiveFilters && !showFilters) ? "primary.main" : "divider",
              color: (hasActiveFilters && !showFilters) ? "primary.main" : "text.secondary",
            }}
          >
            Filtros {hasActiveFilters ? `(${[filtroStatus !== "todos", filtroFuncionario !== "todos", !!filtroData].filter(Boolean).length})` : ""}
          </Button>
          <Button
            variant="contained" disableElevation
            startIcon={<AddRoundedIcon />} onClick={handleCreate}
            sx={{
              borderRadius: 3, textTransform: "none", fontWeight: 700, px: 2.5,
            }}
          >
            Nova Ordem
          </Button>
        </Stack>
      </Stack>

      {hasActiveFilters && !showFilters && (
        <Stack direction="row" spacing={1} mb={2.5}>
          <Chip label="Limpar filtros" onClick={clearFilters} onDelete={clearFilters}
            sx={{ fontWeight: 600, cursor: "pointer", fontSize: 12 }} />
        </Stack>
      )}

      {/* ── Painel de filtros avançados ── */}
      {showFilters && (
        <Fade in timeout={250}>
          <Paper elevation={0} sx={{ p: 2.5, mb: 2.5, borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}`, bgcolor: (t) => alpha(t.palette.primary.main, 0.02) }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Status</InputLabel>
                <Select value={filtroStatus} label="Status" onChange={(e: SelectChangeEvent) => { setFiltroStatus(e.target.value); setPage(0); }}>
                  <MenuItem value="todos">Todos os status</MenuItem>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <MenuItem key={k} value={k}>{v.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Mecânico responsável</InputLabel>
                <Select value={filtroFuncionario} label="Mecânico responsável" onChange={(e: SelectChangeEvent) => { setFiltroFuncionario(e.target.value); setPage(0); }}>
                  <MenuItem value="todos">Todos os mecânicos</MenuItem>
                  {funcionarios.map((f) => <MenuItem key={f.id} value={String(f.id)}>{f.nome}</MenuItem>)}
                </Select>
              </FormControl>

              <TextField
                label="Data de abertura" type="date" size="small"
                value={filtroData}
                onChange={(e) => { setFiltroData(e.target.value); setPage(0); }}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 180 }}
              />

              <Button size="small" onClick={clearFilters} sx={{ textTransform: "none", alignSelf: "center", color: "text.secondary" }}>
                Limpar
              </Button>
            </Stack>
          </Paper>
        </Fade>
      )}

      {/* ── Tabela ── */}
      {loading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : (
        <Fade in timeout={400}>
          <ListTableContainer sx={{ borderRadius: 3 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.03) }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>OS</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Cliente</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Veículo</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Mecânico</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Valor</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.length > 0 ? paginated.map((r) => {
                  const st = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.aberta;
                  return (
                    <TableRow
                      key={r.id}
                      hover
                      onClick={() => r.id && navigate(`/ordens/${r.id}`)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell sx={{ fontSize: 12, color: "text.disabled" }}>#{r.id}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{r.cliente?.nome ?? "—"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{r.veiculo?.modelo ?? "—"}</Typography>
                        <Typography variant="caption" color="text.disabled">{r.veiculo?.placa ?? "—"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{r.funcionario?.nome ?? "—"}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          R$ {Number(r.valor_total ?? 0).toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={st.label} size="small" color={st.color} sx={{ fontWeight: 700, fontSize: 11 }} />
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <IconButton size="small" onClick={(e) => handleMenuOpen(e, r.id)}>
                          <MoreVertRoundedIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ border: 0 }}>
                      <EmptyState
                        icon={<AssignmentRoundedIcon />}
                        title="Nenhuma ordem de serviço"
                        description="Crie a primeira ordem para começar a gerenciar os serviços da oficina."
                        actionLabel="Nova Ordem"
                        onAction={handleCreate}
                        isFiltered={hasActiveFilters}
                        onClearFilter={clearFilters}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ListTableContainer>
        </Fade>
      )}

      {/* ── Paginação ── */}
      {!loading && (
        <TablePagination
          component="div" count={filtered.length} page={page}
          onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[5, 10, 20]} labelRowsPerPage="Linhas por página:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `mais de ${to}`}`}
          sx={{ mt: 1.5, borderRadius: 3, bgcolor: "background.paper", border: (t) => `1px solid ${t.palette.divider}` }}
        />
      )}

      {/* ── Menu ── */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
        <MenuItem onClick={() => { const os = rows.find((r) => r.id === menuId); if (os) handleEdit(os); handleMenuClose(); }}>Editar</MenuItem>
        <MenuItem onClick={() => { if (menuId) navigate(`/ordens/${menuId}`); handleMenuClose(); }}>Ver detalhes</MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>Excluir</MenuItem>
      </Menu>

      <OrdemDialog
        open={openDialog}
        mode={mode}
        initial={current}
        onClose={() => setOpenDialog(false)}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
