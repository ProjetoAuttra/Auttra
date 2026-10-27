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
import { excluirOrdem, criarOrdem, atualizarOrdem, mudarStatusOrdem } from "../api/api";
import { useListaPaginada } from "../../../hooks/useListaPaginada";
import OrdemDialog from "../dialog";
import TableSkeleton from "../../../components/common/TableSkeleton";
import EmptyState from "../../../components/common/EmptyState";
import { IllustrationOS } from "../../../components/common/Illustrations";
import ListTableContainer from "../../../components/common/ListTableContainer";
import { STATUS_CONFIG, STATUS_VALIDOS, VALID_TRANSITIONS, type OrdemStatus } from "../statusConfig";
import ModuleHeader from "../../../components/layout/ModuleHeader";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";

type Ordem = {
  id: number;
  status?: string;
  data_abertura?: string;
  valor_total?: number | string | null;
  cliente?: { nome?: string | null };
  veiculo?: { modelo?: string | null; placa?: string | null };
  funcionario?: { id?: number; nome?: string | null };
  pagamentos?: { status: string }[];
};

type OrdemPayload = Record<string, unknown>;

// ─── Componente ─────────────────────────────────────────────────────────────

export default function OrdensPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { success, error } = useToast();
  const confirm = useConfirm();

  const [funcionarios, setFuncionarios] = React.useState<{ id: number; nome: string }[]>([]);
  const [filtroFuncionario, setFiltroFuncionario] = React.useState("todos");
  const [filtroData, setFiltroData] = React.useState("");
  const [showFilters, setShowFilters] = React.useState(false);
  const [openDialog, setOpenDialog] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [current, setCurrent] = React.useState<Ordem | null>(null);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [menuId, setMenuId] = React.useState<number | null>(null);

  // ── Lê o filtro de status da URL (?status=em_andamento) ──
  const statusParam = searchParams.get("status") ?? "todos";
  const initialStatus = STATUS_VALIDOS.includes(statusParam) ? statusParam : "todos";
  const [filtroStatus, setFiltroStatus] = React.useState(initialStatus);

  const { rows, total, carregandoInicial: loading, page, setPage, rowsPerPage, setRowsPerPage, recarregar } =
    useListaPaginada<Ordem>("/ordens", {
      filtros: { status: filtroStatus, funcionario_id: filtroFuncionario, data: filtroData },
      debounceMs: 0,
      onError: (err) => {
        console.error(err);
        error("Não foi possível carregar as ordens de serviço.");
      },
    });

  // Sincroniza se o usuário navegar para a mesma página com param diferente
  React.useEffect(() => {
    const s = searchParams.get("status") ?? "todos";
    setFiltroStatus(STATUS_VALIDOS.includes(s) ? s : "todos");
    setPage(0);
  }, [searchParams]);

  // ── Carrega ──
  React.useEffect(() => {
    api.get("/funcionarios").then((r) => r.data).catch(() => []).then((funcs) => {
      if (Array.isArray(funcs)) setFuncionarios(funcs);
    });
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
      recarregar();
      success("Ordem excluída com sucesso.");
    } catch { error("Não foi possível excluir a ordem."); }
    finally { handleMenuClose(); }
  };

  const STATUS_CONFIRM: Record<
    string,
    { title: string; confirmLabel: string; variant: "danger" | "warning" | "info" }
  > = {
    em_andamento: { title: "Iniciar atendimento desta OS?", confirmLabel: "Sim, iniciar", variant: "info" },
    concluida: { title: "Concluir esta OS?", confirmLabel: "Sim, concluir e gerar cobrança", variant: "info" },
    cancelada: { title: "Cancelar esta OS?", confirmLabel: "Sim, cancelar OS", variant: "danger" },
  };

  const handleMudarStatus = async (novoStatus: OrdemStatus) => {
    const targetId = menuId;
    if (!targetId) return;
    const os = rows.find((r) => r.id === targetId);
    const cfg = STATUS_CONFIRM[novoStatus];
    const message =
      novoStatus === "concluida"
        ? Number(os?.valor_total ?? 0) > 0
          ? `Isso vai gerar automaticamente uma cobrança de R$ ${Number(os?.valor_total).toFixed(2)} em Contas a Receber.`
          : "Confirma a conclusão desta OS?"
        : novoStatus === "cancelada"
        ? "Esta ação não pode ser desfeita."
        : undefined;
    handleMenuClose();
    const ok = await confirm({ title: cfg.title, message, confirmLabel: cfg.confirmLabel, variant: cfg.variant });
    if (!ok) return;
    try {
      const atualizada = await mudarStatusOrdem(targetId, novoStatus);
      recarregar();
      if (novoStatus === "concluida" && Number(atualizada.valor_total) > 0) {
        success("OS concluída! Cobrança gerada automaticamente em Contas a Receber.");
      } else {
        success("Status da OS atualizado com sucesso!");
      }
    } catch (err: any) {
      error(
        err?.response?.data?.error ??
          err?.response?.data?.message ??
          "Não foi possível atualizar o status da OS."
      );
    }
  };

  const handleSubmit = async (data: OrdemPayload) => {
    try {
      if (mode === "create") {
        await criarOrdem(data);
        recarregar();
        success("Ordem de serviço criada!");
      } else if (current) {
        await atualizarOrdem(current.id, data);
        recarregar();
        success("Ordem atualizada com sucesso!");
      }
      setOpenDialog(false);
    } catch { error("Não foi possível salvar a ordem."); }
  };

  // ── Filtros ──
  const hasActiveFilters = filtroStatus !== "todos" || filtroFuncionario !== "todos" || !!filtroData;

  const clearFilters = () => {
    setFiltroStatus("todos"); setFiltroFuncionario("todos"); setFiltroData("");
  };

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>

      {/* ── Header ── */}
      <ModuleHeader
        title="Ordens de Serviço"
        subtitle="Gerencie as ordens cadastradas na sua oficina"
        icon={<ChecklistRoundedIcon />}
        actions={
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={<TuneRoundedIcon />}
              onClick={() => setShowFilters((p) => !p)}
              sx={{
                borderColor: (hasActiveFilters && !showFilters) ? "primary.main" : "divider",
                color: (hasActiveFilters && !showFilters) ? "primary.main" : "text.secondary",
              }}
            >
              Filtros {hasActiveFilters ? `(${[filtroStatus !== "todos", filtroFuncionario !== "todos", !!filtroData].filter(Boolean).length})` : ""}
            </Button>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={handleCreate}>
              Nova Ordem
            </Button>
          </Stack>
        }
      />

      {hasActiveFilters && !showFilters && (
        <Stack direction="row" spacing={1} mb={2.5}>
          <Chip label="Limpar filtros" onClick={clearFilters} onDelete={clearFilters}
            sx={{ fontWeight: 600, cursor: "pointer", fontSize: 12 }} />
        </Stack>
      )}

      {/* ── Painel de filtros avançados ── */}
      {showFilters && (
        <Fade in timeout={250}>
          <Paper elevation={0} sx={{ p: 2.5, mb: 2.5, borderRadius: 2, border: 0, bgcolor: (t) => alpha(t.palette.primary.main, 0.02) }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Status</InputLabel>
                <Select value={filtroStatus} label="Status" onChange={(e: SelectChangeEvent) => { setFiltroStatus(e.target.value); }}>
                  <MenuItem value="todos">Todos os status</MenuItem>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <MenuItem key={k} value={k}>{v.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Mecânico responsável</InputLabel>
                <Select value={filtroFuncionario} label="Mecânico responsável" onChange={(e: SelectChangeEvent) => { setFiltroFuncionario(e.target.value); }}>
                  <MenuItem value="todos">Todos os mecânicos</MenuItem>
                  {funcionarios.map((f) => <MenuItem key={f.id} value={String(f.id)}>{f.nome}</MenuItem>)}
                </Select>
              </FormControl>

              <TextField
                label="Data de abertura" type="date" size="small"
                value={filtroData}
                onChange={(e) => { setFiltroData(e.target.value); }}
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
          <ListTableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.03) }}>
                  <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>OS</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Cliente</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Veículo</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Mecânico</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Valor</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Pagamento</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: 12 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length > 0 ? rows.map((r) => {
                  const st = STATUS_CONFIG[r.status as OrdemStatus] ?? STATUS_CONFIG.aberta;
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
                        <Chip label={st.label} size="small" color={st.color} sx={{ fontWeight: 600, fontSize: 12 }} />
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const pags = r.pagamentos ?? [];
                          if (pags.length === 0) return <Typography variant="caption" color="text.disabled">—</Typography>;
                          const ativos = pags.filter((p) => p.status !== "cancelado");
                          if (ativos.length === 0) return <Typography variant="caption" color="text.disabled">Cancelado</Typography>;
                          const pagos = ativos.filter((p) => p.status === "pago").length;
                          // Recebimento parcial gera um título de saldo pendente: a OS tem parte paga e parte em aberto.
                          if (pagos === ativos.length) return <Chip label="Pago" size="small" color="success" sx={{ fontWeight: 600, fontSize: 12 }} />;
                          if (pagos > 0) return <Chip label="Parcial" size="small" color="warning" sx={{ fontWeight: 600, fontSize: 12 }} />;
                          return <Chip label="Pendente" size="small" sx={{ fontWeight: 600, fontSize: 12, bgcolor: (t) => alpha(t.palette.warning.main, 0.12), color: "warning.dark" }} />;
                        })()}
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
                    <TableCell colSpan={8} sx={{ border: 0 }}>
                      <EmptyState
                        illustration={<IllustrationOS />}
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
          component="div" count={total} page={page}
          onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
          rowsPerPageOptions={[5, 10, 20]} labelRowsPerPage="Linhas por página:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `mais de ${to}`}`}
          sx={{ bgcolor: "transparent", borderTop: (t) => `1px solid ${t.palette.divider}` }}
        />
      )}

      {/* ── Menu ── */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
        <MenuItem onClick={() => { const os = rows.find((r) => r.id === menuId); if (os) handleEdit(os); handleMenuClose(); }}>Editar</MenuItem>
        <MenuItem onClick={() => { if (menuId) navigate(`/ordens/${menuId}`); handleMenuClose(); }}>Ver detalhes</MenuItem>
        {(() => {
          const os = rows.find((r) => r.id === menuId);
          const allowed = VALID_TRANSITIONS[(os?.status as OrdemStatus) ?? "aberta"] ?? [];
          if (allowed.length === 0) return null;
          return (
            <>
              <Divider />
              {allowed.includes("em_andamento") && (
                <MenuItem onClick={() => handleMudarStatus("em_andamento")}>Iniciar atendimento</MenuItem>
              )}
              {allowed.includes("concluida") && (
                <MenuItem onClick={() => handleMudarStatus("concluida")}>Concluir OS</MenuItem>
              )}
              {allowed.includes("cancelada") && (
                <MenuItem onClick={() => handleMudarStatus("cancelada")} sx={{ color: "error.main" }}>Cancelar OS</MenuItem>
              )}
            </>
          );
        })()}
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
