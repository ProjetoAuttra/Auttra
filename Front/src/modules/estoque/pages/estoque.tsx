import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Stack, Typography, IconButton, Menu, MenuItem, Divider,
  Avatar, Table, TableBody, TableCell, TableHead, TableRow,
  TablePagination, Fade, Chip, Button, TextField, InputAdornment,
  Paper, TableSortLabel,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { AppDialog, AppDialogActions, AppDialogContent } from "../../../components/common/AppDialog";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { useConfirm } from "../../../context/ConfirmContext";
import EstoqueDialog, { type EstoqueItem, type EstoqueForm } from "../dialog";
import {
  listarEstoque, criarEstoque, atualizarEstoque, excluirEstoque, ajustarEstoque,
} from "../api/api";
import ModuleHeader from "../../../components/layout/ModuleHeader";
import ListTableContainer from "../../../components/common/ListTableContainer";
import EmptyState from "../../../components/common/EmptyState";
import { IllustrationEstoque } from "../../../components/common/Illustrations";
import { paths } from "../../../routes/paths";

const LIMITE_BAIXO = 3;

type SortCampo = "nome" | "estoque" | null;
type SortDir = "asc" | "desc";
type TipoAjuste = "entrada" | "saida";

export default function EstoquePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error, warning } = useToast();
  const confirm = useConfirm();

  const [query, setQuery] = React.useState("");
  const [filtroBaixo, setFiltroBaixo] = React.useState(false);
  const [sortCampo, setSortCampo] = React.useState<SortCampo>(null);
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  const [openDialog, setOpenDialog] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [current, setCurrent] = React.useState<EstoqueItem | null>(null);

  const [openAjuste, setOpenAjuste] = React.useState(false);
  const [tipoAjuste, setTipoAjuste] = React.useState<TipoAjuste>("entrada");
  const [qtdAjuste, setQtdAjuste] = React.useState(1);
  const [loadingAjuste, setLoadingAjuste] = React.useState(false);

  const [rows, setRows] = React.useState<EstoqueItem[]>([]);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [menuId, setMenuId] = React.useState<number | null>(null);

  React.useEffect(() => {
    listarEstoque()
      .then(setRows)
      .catch((err) => {
        console.error("Erro ao carregar estoque:", err);
        error("Não foi possível carregar o estoque.");
      });
  }, []);

  // ── Métricas ────────────────────────────────────────────────
  const totalBaixo = rows.filter((r) => Number(r.estoque ?? 0) <= LIMITE_BAIXO).length;

  // ── Filtro + Busca ───────────────────────────────────────────
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchBusca = !q || r.nome.toLowerCase().includes(q) || (r.descricao ?? "").toLowerCase().includes(q);
      const matchBaixo = !filtroBaixo || Number(r.estoque ?? 0) <= LIMITE_BAIXO;
      return matchBusca && matchBaixo;
    });
  }, [rows, query, filtroBaixo]);

  // ── Ordenação ────────────────────────────────────────────────
  const sorted = React.useMemo(() => {
    if (!sortCampo) return filtered;
    return [...filtered].sort((a, b) => {
      if (sortCampo === "nome") {
        const cmp = a.nome.localeCompare(b.nome, "pt-BR");
        return sortDir === "asc" ? cmp : -cmp;
      }
      const cmp = Number(a.estoque ?? 0) - Number(b.estoque ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortCampo, sortDir]);

  const paginated = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleSort = (campo: SortCampo) => {
    if (sortCampo === campo) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCampo(campo); setSortDir("asc"); }
    setPage(0);
  };

  // ── Menu contextual ──────────────────────────────────────────
  const handleMenuOpen = (e: React.MouseEvent<HTMLButtonElement>, id: number) => {
    setAnchorEl(e.currentTarget);
    setMenuId(id);
  };

  const handleMenuClose = () => { setAnchorEl(null); setMenuId(null); };

  const handleEdit = () => {
    const item = rows.find((r) => r.id === menuId);
    if (item) { setMode("edit"); setCurrent(item); setOpenDialog(true); }
    handleMenuClose();
  };

  const handleDelete = async () => {
    if (!menuId) return;
    const ok = await confirm({ title: "Excluir peça?", message: "Esta ação não pode ser desfeita.", confirmLabel: "Sim, excluir", variant: "danger" });
    if (!ok) { handleMenuClose(); return; }
    try {
      await excluirEstoque(menuId);
      setRows((p) => p.filter((x) => x.id !== menuId));
      success("Peça excluída com sucesso.");
    } catch { error("Não foi possível excluir a peça."); }
    finally { handleMenuClose(); }
  };

  const handleAbrirAjuste = (tipo: TipoAjuste) => {
    setTipoAjuste(tipo);
    setQtdAjuste(1);
    setOpenAjuste(true);
    handleMenuClose();
  };

  const handleConfirmarAjuste = async () => {
    if (!menuId && !current) return;
    const id = menuId ?? current?.id;
    if (!id) return;
    setLoadingAjuste(true);
    try {
      const atualizado = await ajustarEstoque(id, tipoAjuste, qtdAjuste);
      setRows((p) => p.map((r) => (r.id === id ? { ...r, estoque: atualizado.estoque } : r)));
      success(tipoAjuste === "entrada" ? "Entrada registrada!" : "Saída registrada!");
      setOpenAjuste(false);
    } catch (err: any) {
      error(err.response?.data?.error ?? "Não foi possível registrar o ajuste.");
    } finally { setLoadingAjuste(false); }
  };

  // ── CRUD ─────────────────────────────────────────────────────
  const onSubmit = async (data: EstoqueForm) => {
    try {
      const oficinaId = user?.oficinaId ?? user?.oficina_id ?? 0;
      if (!oficinaId) { warning("Usuário sem oficina vinculada. Refaça o login."); return; }
      if (mode === "create") {
        const { data: novo, reativado } = await criarEstoque(data, oficinaId);
        setRows((p) => [novo, ...p]);
        success(reativado ? "Peça já existia e foi reativada." : "Peça adicionada ao estoque!");
      } else if (current) {
        const atualizado = await atualizarEstoque(current.id, data);
        setRows((p) => p.map((r) => (r.id === current.id ? atualizado : r)));
        success("Peça atualizada com sucesso!");
      }
      setOpenDialog(false);
    } catch (err: any) {
      error(err.response?.data?.message ?? "Não foi possível salvar a peça.");
    }
  };

  const onDelete = async (id: number) => {
    try {
      await excluirEstoque(id);
      setRows((p) => p.filter((x) => x.id !== id));
      success("Peça excluída com sucesso.");
    } catch { error("Não foi possível excluir a peça."); }
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4 } }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <ModuleHeader
        title="Estoque"
        subtitle="Peças, produtos, custos e disponibilidade para atendimento."
        icon={<Inventory2RoundedIcon />}
        secondaryActionLabel="Importar XML da nota"
        onSecondaryAction={() => navigate(paths.estoqueImportarXml)}
        actionLabel="Nova Peça"
        onAction={() => { setMode("create"); setCurrent(null); setOpenDialog(true); }}
      />

      {/* ── Métricas ───────────────────────────────────────────── */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        <MetricCard label="Total de peças" valor={String(rows.length)} />
        <MetricCard
          label="Baixo estoque"
          valor={String(totalBaixo)}
          destaque={totalBaixo > 0}
          onClick={() => { setFiltroBaixo((v) => !v); setPage(0); }}
          ativo={filtroBaixo}
        />
      </Stack>

      {/* ── Barra de busca ─────────────────────────────────────── */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Pesquisar por nome ou descrição..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" sx={{ color: "text.disabled" }} />
              </InputAdornment>
            ),
          }}
          sx={{ flex: 1 }}
        />
      </Stack>

      {/* ── Tabela ─────────────────────────────────────────────── */}
      <Fade in timeout={400}>
        <ListTableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sortDirection={sortCampo === "nome" ? sortDir : false}>
                  <TableSortLabel
                    active={sortCampo === "nome"}
                    direction={sortCampo === "nome" ? sortDir : "asc"}
                    onClick={() => handleSort("nome")}
                  >
                    Produto
                  </TableSortLabel>
                </TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell>Custo</TableCell>
                <TableCell>Venda</TableCell>
                <TableCell sortDirection={sortCampo === "estoque" ? sortDir : false}>
                  <TableSortLabel
                    active={sortCampo === "estoque"}
                    direction={sortCampo === "estoque" ? sortDir : "asc"}
                    onClick={() => handleSort("estoque")}
                  >
                    Estoque
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginated.length > 0 ? (
                paginated.map((i) => {
                  const baixo = Number(i.estoque ?? 0) <= LIMITE_BAIXO;
                  return (
                    <TableRow key={i.id} hover sx={{ height: 56 }}>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: baixo ? (t) => alpha(t.palette.warning.main, 0.15) : undefined }}>
                            {baixo
                              ? <WarningAmberRoundedIcon fontSize="small" sx={{ color: "warning.main" }} />
                              : <Inventory2RoundedIcon fontSize="small" />}
                          </Avatar>
                          <Typography fontWeight={400}>{i.nome}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ fontSize: 14, color: "text.secondary" }}>{i.descricao || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 14 }}>
                        {Number(i.preco_custo).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell sx={{ fontSize: 14, color: "success.main" }}>
                        {Number(i.preco_venda).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={i.estoque ?? 0}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            bgcolor: baixo
                              ? (t) => alpha(t.palette.warning.main, 0.12)
                              : (t) => alpha(t.palette.success.main, 0.1),
                            color: baixo ? "warning.dark" : "success.main",
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton onClick={(e) => handleMenuOpen(e, i.id)}>
                          <MoreVertRoundedIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} sx={{ border: 0 }}>
                    <EmptyState
                      illustration={<IllustrationEstoque />}
                      icon={<Inventory2RoundedIcon />}
                      title={filtroBaixo ? "Nenhuma peça com estoque baixo" : "Nenhuma peça cadastrada"}
                      description={filtroBaixo ? "Todas as peças estão com estoque adequado." : "Cadastre a primeira peça para controlar o inventário da oficina."}
                      actionLabel={filtroBaixo ? undefined : "Nova Peça"}
                      onAction={filtroBaixo ? undefined : () => { setMode("create"); setCurrent(null); setOpenDialog(true); }}
                      isFiltered={!!query}
                      onClearFilter={() => { setQuery(""); setFiltroBaixo(false); }}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ListTableContainer>
      </Fade>

      {/* ── Paginação ───────────────────────────────────────────── */}
      <TablePagination
        component="div"
        count={sorted.length}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[5, 10, 20]}
        labelRowsPerPage="Linhas por página:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        sx={{ mt: 1.5, borderRadius: 2, bgcolor: "background.paper" }}
      />

      {/* ── Menu contextual ─────────────────────────────────────── */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={() => handleAbrirAjuste("entrada")} sx={{ color: "success.main" }}>
          <AddRoundedIcon fontSize="small" sx={{ mr: 1 }} /> Entrada
        </MenuItem>
        <MenuItem onClick={() => handleAbrirAjuste("saida")} sx={{ color: "error.main" }}>
          <RemoveRoundedIcon fontSize="small" sx={{ mr: 1 }} /> Saída
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleEdit}>Editar</MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>Excluir</MenuItem>
      </Menu>

      {/* ── Dialog de Ajuste (Entrada / Saída) ─────────────────── */}
      <AppDialog open={openAjuste} onClose={() => setOpenAjuste(false)} onCloseClick={() => setOpenAjuste(false)} closeOnBackdrop={false} closeOnEscape={false} maxWidth="xs" title={tipoAjuste === "entrada" ? "Entrada de peças" : "Saída de peças"} icon={tipoAjuste === "entrada" ? <AddRoundedIcon /> : <RemoveRoundedIcon />} variant="entity">
        <Box sx={{ display: "none" }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Stack sx={{
              width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center",
              bgcolor: (t) => alpha(tipoAjuste === "entrada" ? t.palette.success.main : t.palette.error.main, 0.15),
              color: tipoAjuste === "entrada" ? "success.main" : "error.main",
            }}>
              {tipoAjuste === "entrada" ? <AddRoundedIcon /> : <RemoveRoundedIcon />}
            </Stack>
            <Stack>
              <Typography variant="subtitle1" fontWeight={800}>
                {tipoAjuste === "entrada" ? "Entrada de peças" : "Saída de peças"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {rows.find((r) => r.id === menuId)?.nome ?? ""}
              </Typography>
            </Stack>
          </Stack>
          <IconButton size="small" onClick={() => setOpenAjuste(false)}>
            <CloseRoundedIcon />
          </IconButton>
        </Box>

        <AppDialogContent>
          <TextField
            label="Quantidade"
            type="number"
            value={qtdAjuste}
            onChange={(e) => setQtdAjuste(Math.max(1, parseInt(e.target.value) || 1))}
            size="small"
            fullWidth
            autoFocus
            inputProps={{ min: 1 }}
          />
          {tipoAjuste === "saida" && (() => {
            const peca = rows.find((r) => r.id === menuId);
            return peca ? (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                Disponível em estoque: <strong>{peca.estoque}</strong>
              </Typography>
            ) : null;
          })()}
        </AppDialogContent>

        <AppDialogActions>
          <Button onClick={() => setOpenAjuste(false)} variant="outlined" sx={{ borderRadius: 999 }}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmarAjuste}
            variant="contained"
            disabled={loadingAjuste}
            color={tipoAjuste === "entrada" ? "success" : "error"}
            sx={{ borderRadius: 999 }}
          >
            {loadingAjuste ? "Salvando..." : "Confirmar"}
          </Button>
        </AppDialogActions>
      </AppDialog>

      {/* ── Dialog de Cadastro/Edição ───────────────────────────── */}
      <EstoqueDialog
        open={openDialog}
        mode={mode}
        initial={current}
        onClose={() => setOpenDialog(false)}
        onSubmit={onSubmit}
        onDelete={(i) => onDelete(i.id)}
      />
    </Box>
  );
}

function MetricCard({
  label, valor, destaque = false, ativo = false, onClick,
}: {
  label: string; valor: string; destaque?: boolean; ativo?: boolean; onClick?: () => void;
}) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        px: 2.5, py: 1.5, borderRadius: 2, flex: 1, minWidth: 140,
        cursor: onClick ? "pointer" : "default",
        borderColor: ativo ? "primary.main" : destaque ? "warning.main" : "divider",
        bgcolor: ativo ? (t) => alpha(t.palette.primary.main, 0.04)
          : destaque ? (t) => alpha(t.palette.warning.main, 0.04) : "background.paper",
        transition: "border-color .2s, background .2s",
        "&:hover": onClick ? { borderColor: "primary.main" } : {},
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={600}
        sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={800} color={destaque && !ativo ? "warning.dark" : "text.primary"}>
        {valor}
      </Typography>
    </Paper>
  );
}
