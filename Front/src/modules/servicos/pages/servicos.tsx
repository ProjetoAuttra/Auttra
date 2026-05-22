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
import { listarServicos, criarServico, atualizarServico, excluirServico } from "../api/api";
import ModuleHeader from "../../../components/layout/ModuleHeader";
import ListTableContainer from "../../../components/common/ListTableContainer";

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
  const [rows, setRows] = React.useState<Servico[]>([]);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [menuId, setMenuId] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  React.useEffect(() => {
    listarServicos(user?.oficina_id)
      .then(setRows)
      .catch((err) => {
        console.error("Erro ao carregar serviços:", err);
        error("Não foi possível carregar os serviços.");
      })
      .finally(() => setLoading(false));
  }, [user?.oficina_id]);

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
      setRows((p) => p.filter((x) => x.id !== menuId));
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
        const { data: novo, reativado } = await criarServico(data, oficinaId);
        setRows((p) => [novo, ...p]);
        success(reativado ? "Serviço já existia e foi reativado." : "Serviço cadastrado com sucesso!");
      } else if (current) {
        const atualizado = await atualizarServico(current.id, data);
        setRows((p) => p.map((r) => (r.id === current.id ? atualizado : r)));
        success("Serviço atualizado com sucesso!");
      }
      setOpenDialog(false);
    } catch (err) {
      console.error("Erro ao salvar serviço:", err);
      error("Não foi possível salvar o serviço.");
    }
  };

  const categoriasUsadas = React.useMemo(() => {
    const set = new Set(rows.map((r) => r.categoria).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    const matchQuery = !q || r.nome.toLowerCase().includes(q) || (r.categoria ?? "").toLowerCase().includes(q);
    const matchCategoria = !categoriaFiltro || r.categoria === categoriaFiltro;
    return matchQuery && matchCategoria;
  });

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const disponiveis = rows.filter((r) => r.ativo !== false).length;

  if (loading) return <Box sx={{ textAlign: "center", mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4 } }}>
      <ModuleHeader
        title="Serviços"
        subtitle="Catálogo de mão de obra, valores e serviços recorrentes."
        icon={<BuildRoundedIcon />}
        metrics={[
          { label: "Cadastrados", value: rows.length, tone: "primary" },
          { label: "Disponíveis", value: disponiveis, tone: "success" },
          { label: "Filtrados", value: filtered.length, tone: "neutral" },
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
            variant={categoriaFiltro === null ? "filled" : "outlined"}
            color={categoriaFiltro === null ? "primary" : "default"}
            onClick={() => { setCategoriaFiltro(null); setPage(0); }}
            sx={{ fontWeight: 600 }}
          />
          {categoriasUsadas.map((cat) => (
            <Chip
              key={cat}
              label={CATEGORIA_LABEL[cat] ?? cat}
              size="small"
              variant={categoriaFiltro === cat ? "filled" : "outlined"}
              color={categoriaFiltro === cat ? "primary" : "default"}
              onClick={() => { setCategoriaFiltro(cat === categoriaFiltro ? null : cat); setPage(0); }}
              sx={{ fontWeight: 600 }}
            />
          ))}
        </Stack>
      )}

      <Fade in timeout={400}>
        <ListTableContainer>
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
              {paginated.length > 0 ? paginated.map((s) => (
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
                        variant="outlined"
                        sx={{ fontSize: 11, fontWeight: 600 }}
                      />
                    ) : (
                      <Typography variant="body2" color="text.disabled">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700} color="success.main">
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
                  <TableCell colSpan={6} align="center" sx={{ py: 8, color: "text.secondary" }}>
                    Nenhum serviço encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ListTableContainer>
      </Fade>

      <TablePagination component="div" count={filtered.length} page={page}
        onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[5, 10, 20]} labelRowsPerPage="Linhas por página:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `mais de ${to}`}`}
        sx={{ mt: 1.5, borderRadius: 2, bgcolor: "background.paper" }}
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
            .then(() => { setRows((p) => p.filter((x) => x.id !== s.id)); success("Serviço excluído."); setOpenDialog(false); })
            .catch(() => error("Não foi possível excluir o serviço."));
        }} />
    </Box>
  );
}
