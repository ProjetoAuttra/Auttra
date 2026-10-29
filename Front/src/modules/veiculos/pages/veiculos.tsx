import * as React from "react";
import {
  Box, Stack, Typography, IconButton, Button,
  Chip, Avatar, Menu, MenuItem, Divider, Table, TableBody, TableCell,
  TableHead, TableRow, TablePagination, Fade, CircularProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import ColorLensRoundedIcon from "@mui/icons-material/ColorLensRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { useConfirm } from "../../../context/ConfirmContext";
import { useNavigate } from "react-router-dom";
import VeiculoDialog, { type Veiculo, type VeiculoForm } from "../dialog";
import { mapVeiculo, criarVeiculo, atualizarVeiculo, excluirVeiculo } from "../api/api";
import { useListaPaginada } from "../../../hooks/useListaPaginada";
import ModuleHeader from "../../../components/layout/ModuleHeader";
import ListTableContainer from "../../../components/common/ListTableContainer";
import EmptyState from "../../../components/common/EmptyState";
import { IllustrationVeiculos } from "../../../components/common/Illustrations";

const COMBUSTIVEL_LABEL: Record<string, string> = {
  gasolina: "Gasolina", etanol: "Etanol", flex: "Flex",
  diesel: "Diesel", gnv: "GNV", eletrico: "Elétrico", hibrido: "Híbrido",
};

export default function VeiculosPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();

  const [query, setQuery] = React.useState("");
  const [openDialog, setOpenDialog] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [current, setCurrent] = React.useState<Veiculo | null>(null);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [menuId, setMenuId] = React.useState<string | null>(null);

  const { rows: rowsApi, total, carregandoInicial, page, setPage, rowsPerPage, setRowsPerPage, recarregar } =
    useListaPaginada<any>("/veiculos", {
      filtros: { search: query },
      onError: (err) => {
        console.error("Erro ao carregar veículos:", err);
        error("Não foi possível carregar os veículos.");
      },
    });
  const rows = React.useMemo<Veiculo[]>(() => rowsApi.map(mapVeiculo), [rowsApi]);

  const openCreate = () => { setMode("create"); setCurrent(null); setOpenDialog(true); };
  const openEdit = (v: Veiculo) => { setMode("edit"); setCurrent(v); setOpenDialog(true); };
  const handleMenuOpen = (e: React.MouseEvent<HTMLButtonElement>, id: string) => { setAnchorEl(e.currentTarget); setMenuId(id); };
  const handleMenuClose = () => { setAnchorEl(null); setMenuId(null); };
  const handleEdit = () => { const v = rows.find((r) => r.id === menuId); if (v) openEdit(v); handleMenuClose(); };

  const handleDelete = async () => {
    if (!menuId) return;
    const ok = await confirm({
      title: "Excluir veículo?",
      message: "O histórico de ordens vinculado será mantido, mas o veículo será removido.",
      confirmLabel: "Sim, excluir",
      variant: "danger",
    });
    if (!ok) { handleMenuClose(); return; }
    try {
      await excluirVeiculo(menuId);
      recarregar();
      success("Veículo excluído com sucesso.");
    } catch {
      error("Não foi possível excluir o veículo.");
    } finally {
      handleMenuClose();
    }
  };

  const onSubmit = async (data: VeiculoForm) => {
    try {
      if (mode === "create") {
        if (!user?.oficina_id) { error("Usuário sem oficina vinculada."); return; }
        const novo = await criarVeiculo(data, user.oficina_id);
        success("Veículo cadastrado com sucesso!");
        nav(`/veiculos/${novo.id}`);
      } else if (current) {
        await atualizarVeiculo(current.id, data);
        recarregar();
        success("Veículo atualizado com sucesso!");
      }
      setOpenDialog(false);
    } catch (err) {
      console.error("Erro ao salvar veículo:", err);
      error("Não foi possível salvar o veículo.");
    }
  };

  if (carregandoInicial) return <Box sx={{ textAlign: "center", mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>
      <ModuleHeader
        title="Veículos"
        subtitle="Controle placas, proprietários e dados dos veículos atendidos."
        icon={<DirectionsCarRoundedIcon />}
        metrics={[
          { label: query.trim() ? "Encontrados" : "Cadastrados", value: total, tone: "primary" },
        ]}
        searchValue={query}
        searchPlaceholder="Pesquisar por placa, modelo, marca ou cliente"
        onSearchChange={setQuery}
        actionLabel="Novo Veículo"
        onAction={openCreate}
      />

      <Fade in timeout={400}>
        <ListTableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Veículo</TableCell>
                <TableCell>Placa</TableCell>
                <TableCell>Cor</TableCell>
                <TableCell>Combustível</TableCell>
                <TableCell>Quilometragem</TableCell>
                <TableCell>Proprietário</TableCell>
                <TableCell align="right" aria-label="Ações" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length > 0 ? rows.map((v) => (
                <TableRow
                  key={v.id} hover sx={{ height: 56, cursor: "pointer" }}
                  onDoubleClick={() => nav(`/veiculos/${v.id}`)}
                >
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main" }}>
                        <DirectionsCarRoundedIcon fontSize="small" />
                      </Avatar>
                      <Stack spacing={0}>
                        <Typography variant="body2" fontWeight={600}>{v.marca} {v.modelo}</Typography>
                        {v.ano && (
                          <Typography variant="caption" color="text.secondary">{v.ano}</Typography>
                        )}
                      </Stack>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                      {v.placa || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                      {v.cor && <ColorLensRoundedIcon sx={{ fontSize: 15, opacity: 0.6 }} />}
                      <Typography variant="body2">{v.cor || "—"}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {v.combustivel ? COMBUSTIVEL_LABEL[v.combustivel] ?? v.combustivel : "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {v.quilometragem
                        ? `${Number(v.quilometragem).toLocaleString("pt-BR")} km`
                        : "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {v.cliente_nome ? (
                      <Button
                        size="small" variant="text"
                        onClick={(e) => { e.stopPropagation(); nav(`/clientes/${v.cliente_id}`); }}
                        sx={{ textTransform: "none", fontWeight: 600, p: 0, minWidth: 0 }}
                      >
                        {v.cliente_nome}
                      </Button>
                    ) : "—"}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, v.id); }}
                    >
                      <MoreVertRoundedIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={7} sx={{ border: 0 }}>
                    <EmptyState
                      illustration={<IllustrationVeiculos />}
                      icon={<DirectionsCarRoundedIcon />}
                      title="Nenhum veículo cadastrado"
                      description="Cadastre o primeiro veículo para vincular aos clientes e às ordens de serviço."
                      actionLabel="Novo Veículo"
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

      <VeiculoDialog open={openDialog} mode={mode} initial={current} onClose={() => setOpenDialog(false)}
        onSubmit={onSubmit} />
    </Box>
  );
}
