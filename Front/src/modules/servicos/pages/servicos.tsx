import * as React from "react";
import {
  Box, Stack, Typography, IconButton, Chip,
  Menu, MenuItem, Avatar, Table, TableBody, TableCell,
  TableHead, TableRow, TablePagination, Fade, Divider, CircularProgress,
} from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { useConfirm } from "../../../context/ConfirmContext";
import ServicoDialog, { type Servico, type ServicoForm, CATEGORIAS } from "../dialog";
import { mapServico, criarServico, atualizarServico, excluirServico } from "../api/api";
import { useListaPaginada } from "../../../hooks/useListaPaginada";
import ModuleHeader from "../../../components/layout/ModuleHeader";
import ListTableContainer from "../../../components/common/ListTableContainer";
import EmptyState from "../../../components/common/EmptyState";

const CATEGORIA_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.value, c.label])
);

function formatTempo(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function ServicosPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const confirm = useConfirm();

  const [query, setQuery] = React.useState("");
  const [categoriaFiltro, setCategoriaFiltro] = React.useState<string | null>(null);
  const [openDialog, setOpenDialog] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [current, setCurrent] = React.useState<Servico | null>(null);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [menuId, setMenuId] = React.useState<number | null>(null);

  const { rows: rowsApi, total, carregandoInicial, page, setPage, rowsPerPage, setRowsPerPage, recarregar } =
    useListaPaginada<any>("/servicos", {
      filtros: { search: query, categoria: categoriaFiltro },
      onError: (err) => {
        console.error("Erro ao carregar serviços:", err);
        error("Não foi possível carregar os serviços.");
      },
    });
  const rows = React.useMemo<Servico[]>(() => rowsApi.map(mapServico), [rowsApi]);

  const openCreate = () => { setMode("create"); setCurrent(null); setOpenDialog(true); };
  const openEdit = (s: Servico) => { setMode("edit"); setCurrent(s); setOpenDialog(true); };
  const handleMenuOpen = (e: React.MouseEvent<HTMLButtonElement>, id: number) => { setAnchorEl(e.currentTarget); setMenuId(id); };
  const handleMenuClose = () => { setAnchorEl(null); setMenuId(null); };
  const handleEdit = () => { const s = rows.find((r) => r.id === menuId); if (s) openEdit(s); handleMenuClose(); };

  const handleDelete = async () => {
    if (!menuId) return;
    const ok = await confirm({
      title: "Excluir serviço?",
      message: "Ordens já criadas com este serviço não serão afetadas.",
      confirmLabel: "Sim, excluir",
      variant: "danger",
    });
    if (!ok) { handleMenuClose(); return; }
    try {
      await excluirServico(menuId);
      recarregar();
      success("Serviço excluído com sucesso.");
    } catch {
      error("Não foi possível excluir o serviço.");
    } finally {
      handleMenuClose();
    }
  };

  const onSubmit = async (data: ServicoForm) => {
    try {
      const oficinaId = user?.oficina_id;
      if (!oficinaId) { error("Usuário sem oficina vinculada."); return; }
      if (mode === "create") {
        const { reativado } = await criarServico(data, oficinaId);
        recarregar();
        success(reativado ? "Serviço já existia e foi reativado." : "Serviço cadastrado com sucesso!");
      } else if (current) {
        await atualizarServico(current.id, data);
        recarregar();
        success("Serviço atualizado com sucesso!");
      }
      setOpenDialog(false);
    } catch (err) {
      console.error("Erro ao salvar serviço:", err);
      error("Não foi possível salvar o serviço.");
    }
  };

  const categoriasUsadas = CATEGORIAS.map((c) => c.value);

  if (carregandoInicial) return <Box sx={{ textAlign: "center", mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>
      <ModuleHeader
        title="Serviços"
        subtitle="Catálogo de mão de obra, valores e serviços recorrentes."
        icon={<BuildRoundedIcon />}
        metrics={[
          { label: query.trim() || categoriaFiltro ? "Encontrados" : "Cadastrados", value: total, tone: "primary" },
        ]}
        searchValue={query}
        searchPlaceholder="Pesquisar serviço ou categoria"
        onSearchChange={setQuery}
        actionLabel="Novo Serviço"
        onAction={openCreate}
      />

      {categoriasUsadas.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={1} mb={2}>
          <Chip
            label="Todos"
            size="small"
            color={categoriaFiltro === null ? "primary" : "default"}
            onClick={() => { setCategoriaFiltro(null); setPage(0); }}
            sx={{ fontWeight: 600 }}
          />
          {categoriasUsadas.map((cat) => (
            <Chip
              key={cat}
              label={CATEGORIA_LABEL[cat] ?? cat}
              size="small"
              color={categoriaFiltro === cat ? "primary" : "default"}
              onClick={() => setCategoriaFiltro(cat === categoriaFiltro ? null : cat)}
              sx={{ fontWeight: 600 }}
            />
          ))}
        </Stack>
      )}

      <Fade in timeout={400}>
        <ListTableContainer sx={{ height: "auto" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Serviço</TableCell>
                <TableCell>Categoria</TableCell>
                <TableCell>Preço</TableCell>
                <TableCell>Tempo</TableCell>
                <TableCell>Disponível</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length > 0 ? rows.map((s) => (
                <TableRow key={s.id} hover sx={{ height: 56 }}>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main" }}>
                        <BuildRoundedIcon fontSize="small" />
                      </Avatar>
                      <Stack spacing={0}>
                        <Typography variant="body2" fontWeight={600}>{s.nome}</Typography>
                        {s.descricao && (
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 260 }}>
                            {s.descricao}
                          </Typography>
                        )}
                      </Stack>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {s.categoria ? (
                      <Chip
                        label={CATEGORIA_LABEL[s.categoria] ?? s.categoria}
                        size="small"
                        sx={{ fontSize: 12, fontWeight: 600 }}
                      />
                    ) : (
                      <Typography variant="body2" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} color="success.main">
                      {Number(s.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {s.tempo_estimado ? (
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <AccessTimeRoundedIcon sx={{ fontSize: 14, color: "text.disabled" }} />
                        <Typography variant="body2">{formatTempo(s.tempo_estimado)}</Typography>
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.ativo !== false ? (
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <CheckCircleRoundedIcon sx={{ fontSize: 16, color: "success.main" }} />
                        <Typography variant="body2" color="success.main" fontWeight={600}>Sim</Typography>
                      </Stack>
                    ) : (
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <CancelRoundedIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                        <Typography variant="body2" color="text.disabled">Não</Typography>
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, s.id); }}>
                      <MoreVertRoundedIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} sx={{ border: 0 }}>
                    <EmptyState
                      icon={<BuildRoundedIcon />}
                      title="Nenhum serviço cadastrado"
                      description="Cadastre os serviços e valores que a oficina oferece."
                      actionLabel="Novo Serviço"
                      onAction={openCreate}
                      isFiltered={!!query}
                      onClearFilter={() => setQuery("")}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ListTableContainer>
      </Fade>

      <TablePagination component="div" count={total} page={page}
        onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[5, 10, 20]} labelRowsPerPage="Linhas por página:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `mais de ${to}`}`}
        sx={{ bgcolor: "transparent", borderTop: (t) => `1px solid ${t.palette.divider}` }}
      />

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
        <MenuItem onClick={handleEdit}>Editar</MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>Excluir</MenuItem>
      </Menu>

      <ServicoDialog open={openDialog} mode={mode} initial={current} onClose={() => setOpenDialog(false)}
        onSubmit={onSubmit} onDelete={(s) => {
          excluirServico(s.id)
            .then(() => { recarregar(); success("Serviço excluído."); setOpenDialog(false); })
            .catch(() => error("Não foi possível excluir o serviço."));
        }} />
    </Box>
  );
}
