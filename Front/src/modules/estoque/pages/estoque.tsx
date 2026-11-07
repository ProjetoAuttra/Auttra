import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box, Stack, Typography, IconButton, Menu, MenuItem, Divider,
  Avatar, Table, TableBody, TableCell, TableHead, TableRow,
  TablePagination, Fade, Chip, Button, TextField, InputAdornment,
  TableSortLabel, Tooltip, CircularProgress,
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
  criarEstoque, atualizarEstoque, excluirEstoque, ajustarEstoque,
} from "../api/api";
import { useListaPaginada } from "../../../hooks/useListaPaginada";
import ModuleHeader from "../../../components/layout/ModuleHeader";
import StatCard, { StatGroup } from "../../../components/common/StatCard";
import ListTableContainer from "../../../components/common/ListTableContainer";
import EmptyState from "../../../components/common/EmptyState";
import { IllustrationEstoque } from "../../../components/common/Illustrations";
import { paths } from "../../../routes/paths";
import { formatarQuantidade, lerQuantidade } from "../../../utils/quantidade";

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
  // Filtro de estoque baixo na URL (?baixo=1): o alerta do painel abre a lista já filtrada.
  const [searchParams, setSearchParams] = useSearchParams();
  const filtroBaixo = searchParams.get("baixo") === "1";
  const setFiltroBaixo = React.useCallback((valor: boolean | ((atual: boolean) => boolean)) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const ligado = typeof valor === "function" ? valor(prev.get("baixo") === "1") : valor;
      if (ligado) next.set("baixo", "1");
      else next.delete("baixo");
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const [sortCampo, setSortCampo] = React.useState<SortCampo>(null);
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  const [openDialog, setOpenDialog] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [current, setCurrent] = React.useState<EstoqueItem | null>(null);

  const [openAjuste, setOpenAjuste] = React.useState(false);
  const [tipoAjuste, setTipoAjuste] = React.useState<TipoAjuste>("entrada");
  // A peça do ajuste fica guardada à parte: o menuId é limpo ao fechar o menu.
  const [pecaAjuste, setPecaAjuste] = React.useState<EstoqueItem | null>(null);
  // Quantidade guardada como texto: apagar o campo não volta para 1; a validação é feita ao confirmar.
  const [qtdAjuste, setQtdAjuste] = React.useState("1");
  const [erroQtd, setErroQtd] = React.useState("");
  const [loadingAjuste, setLoadingAjuste] = React.useState(false);

  const { rows, total, page, setPage, rowsPerPage, setRowsPerPage, recarregar: recarregarLista } =
    useListaPaginada<EstoqueItem>("/pecas", {
      filtros: {
        search: query,
        estoque_maximo: filtroBaixo ? LIMITE_BAIXO : undefined,
        ordenar_por: sortCampo ?? undefined,
        direcao: sortCampo ? sortDir : undefined,
      },
      onError: (err) => {
        console.error("Erro ao carregar estoque:", err);
        error("Não foi possível carregar o estoque.");
      },
    });
  // Contagens dos cards: pedem só o total (limit=1), independentes de página, busca e filtro.
  const contagemGeral = useListaPaginada<EstoqueItem>("/pecas", { linhasPorPaginaInicial: 1 });
  const contagemBaixo = useListaPaginada<EstoqueItem>("/pecas", {
    filtros: { estoque_maximo: LIMITE_BAIXO },
    linhasPorPaginaInicial: 1,
  });
  const recarregar = () => {
    recarregarLista();
    contagemGeral.recarregar();
    contagemBaixo.recarregar();
  };
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [menuId, setMenuId] = React.useState<number | null>(null);

  const totalBaixo = contagemBaixo.total;

  const handleSort = (campo: SortCampo) => {
    if (sortCampo === campo) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCampo(campo); setSortDir("asc"); }
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
      recarregar();
      success("Peça excluída com sucesso.");
    } catch { error("Não foi possível excluir a peça."); }
    finally { handleMenuClose(); }
  };

  const handleAbrirAjuste = (tipo: TipoAjuste, peca: EstoqueItem) => {
    setPecaAjuste(peca);
    setTipoAjuste(tipo);
    setQtdAjuste("1");
    setErroQtd("");
    setOpenAjuste(true);
    handleMenuClose();
  };

  // Saída maior que o disponível já aparece como erro enquanto digita.
  const qtdDigitada = lerQuantidade(qtdAjuste) ?? NaN;
  const excedeDisponivel = tipoAjuste === "saida" && !!pecaAjuste && qtdDigitada > Number(pecaAjuste.estoque);
  const erroQuantidade = erroQtd || (excedeDisponivel ? `Máximo disponível: ${formatarQuantidade(pecaAjuste?.estoque, pecaAjuste?.unidade)}` : "");

  const handleConfirmarAjuste = async () => {
    if (loadingAjuste || !pecaAjuste) return;
    if (!(qtdDigitada > 0)) {
      setErroQtd("Informe um número maior que zero, com até 3 casas decimais");
      return;
    }
    if (excedeDisponivel) return;
    setLoadingAjuste(true);
    try {
      await ajustarEstoque(pecaAjuste.id, tipoAjuste, qtdDigitada);
      recarregar();
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
        const { reativado } = await criarEstoque(data, oficinaId);
        recarregar();
        success(reativado ? "Peça já existia e foi reativada." : "Peça adicionada ao estoque!");
      } else if (current) {
        await atualizarEstoque(current.id, data);
        recarregar();
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
      recarregar();
      success("Peça excluída com sucesso.");
    } catch (err) {
      error("Não foi possível excluir a peça.");
      throw err; // a gaveta continua aberta
    }
  };

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <ModuleHeader
        title="Estoque"
        subtitle="Peças, produtos, custos e disponibilidade para atendimento."
        icon={<Inventory2RoundedIcon />}
        secondaryActionLabel="Importar XML da nota"
        onSecondaryAction={() => navigate(paths.estoqueImportarXml)}
        actionLabel="Peça"
        onAction={() => { setMode("create"); setCurrent(null); setOpenDialog(true); }}
      />

      {/* ── Métricas ───────────────────────────────────────────── */}
      <StatGroup>
        <StatCard label="Total de peças" value={contagemGeral.total} />
        <StatCard
          label="Baixo estoque"
          value={totalBaixo}
          tone={totalBaixo > 0 && !filtroBaixo ? "warning" : "default"}
          onClick={() => setFiltroBaixo((v) => !v)}
          active={filtroBaixo}
        />
      </StatGroup>

      {/* ── Barra de busca ─────────────────────────────────────── */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Pesquisar por nome ou descrição..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
                <TableCell align="right" aria-label="Ações" />
              </TableRow>
            </TableHead>

            <TableBody>
              {rows.length > 0 ? (
                rows.map((i) => {
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
                          label={formatarQuantidade(i.estoque, i.unidade)}
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
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Registrar entrada">
                            <IconButton size="small" onClick={() => handleAbrirAjuste("entrada", i)} sx={{ color: "success.main" }}>
                              <AddRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Registrar saída">
                            <IconButton size="small" onClick={() => handleAbrirAjuste("saida", i)} sx={{ color: "error.main" }}>
                              <RemoveRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <IconButton aria-label="Mais ações" onClick={(e) => handleMenuOpen(e, i.id)}>
                            <MoreVertRoundedIcon />
                          </IconButton>
                        </Stack>
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
                      actionLabel={filtroBaixo ? undefined : "Peça"}
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
        count={total}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[5, 10, 20]}
        labelRowsPerPage="Linhas por página:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        sx={{ bgcolor: "transparent", borderTop: (t) => `1px solid ${t.palette.divider}` }}
      />

      {/* ── Menu contextual ─────────────────────────────────────── */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={handleEdit}>Editar</MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>Excluir</MenuItem>
      </Menu>

      {/* ── Dialog de Ajuste (Entrada / Saída) ─────────────────── */}
      <AppDialog open={openAjuste} onClose={() => setOpenAjuste(false)} onCloseClick={() => setOpenAjuste(false)} closeOnBackdrop={false} maxWidth="xs" title={tipoAjuste === "entrada" ? "Entrada de peças" : "Saída de peças"} icon={tipoAjuste === "entrada" ? <AddRoundedIcon /> : <RemoveRoundedIcon />} variant="entity">
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
              <Typography variant="subtitle1" fontWeight={700}>
                {tipoAjuste === "entrada" ? "Entrada de peças" : "Saída de peças"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {pecaAjuste?.nome ?? ""}
              </Typography>
            </Stack>
          </Stack>
          <IconButton aria-label="Fechar" size="small" onClick={() => setOpenAjuste(false)}>
            <CloseRoundedIcon />
          </IconButton>
        </Box>

        <AppDialogContent>
          <TextField
            label="Quantidade"
            value={qtdAjuste}
            onChange={(e) => { setQtdAjuste(e.target.value.replace(/[^\d.,]/g, "")); setErroQtd(""); }}
            size="small"
            fullWidth
            autoFocus
            error={!!erroQuantidade}
            helperText={erroQuantidade || undefined}
            inputProps={{ inputMode: "decimal" }}
            InputProps={pecaAjuste?.unidade ? { endAdornment: <InputAdornment position="end">{pecaAjuste.unidade}</InputAdornment> } : undefined}
          />
          {tipoAjuste === "saida" && pecaAjuste && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              Disponível em estoque: <strong>{formatarQuantidade(pecaAjuste.estoque, pecaAjuste.unidade)}</strong>
            </Typography>
          )}
        </AppDialogContent>

        <AppDialogActions>
          <Button onClick={() => setOpenAjuste(false)} variant="outlined">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmarAjuste}
            variant="contained"
            disabled={loadingAjuste || excedeDisponivel}
            startIcon={loadingAjuste ? <CircularProgress size={16} color="inherit" /> : undefined}
            color={tipoAjuste === "entrada" ? "success" : "error"}
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
