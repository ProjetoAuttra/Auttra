import * as React from "react";
import {
  Box, Stack, Typography, IconButton,
  Table, TableBody, TableCell, TableHead, TableRow,
  TablePagination, Fade, Menu, MenuItem, Divider, CircularProgress,
} from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { useConfirm } from "../../../context/ConfirmContext";
import SupplierDialog, { type Supplier, type SupplierForm } from "../dialog";
import api from "../../../api/api";
import ModuleHeader from "../../../components/layout/ModuleHeader";
import ListTableContainer from "../../../components/common/ListTableContainer";

export default function SuppliersPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const confirm = useConfirm();

  const [rows, setRows] = React.useState<Supplier[]>([]);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [openDialog, setOpenDialog] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [current, setCurrent] = React.useState<Supplier | null>(null);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [menuId, setMenuId] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  const oficinaId = user?.oficina_id ?? user?.oficinaId ?? 0;

  React.useEffect(() => {
    api.get("/fornecedores")
      .then((r) => setRows(r.data))
      .catch((err) => {
        console.error("Erro ao carregar fornecedores:", err);
        error("Não foi possível carregar os fornecedores.");
      })
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => { setMode("create"); setCurrent(null); setOpenDialog(true); };
  const openEdit = (s: Supplier) => { setMode("edit"); setCurrent(s); setOpenDialog(true); };
  const handleMenuOpen = (e: React.MouseEvent<HTMLButtonElement>, id: string) => { setAnchorEl(e.currentTarget); setMenuId(id); };
  const handleMenuClose = () => { setAnchorEl(null); setMenuId(null); };
  const handleEdit = () => { const s = rows.find((r) => r.id === menuId); if (s) openEdit(s); handleMenuClose(); };

  const handleDelete = async () => {
    if (!menuId) return;
    const ok = await confirm({
      title: "Excluir fornecedor?",
      message: "Esta ação não pode ser desfeita.",
      confirmLabel: "Sim, excluir",
      variant: "danger",
    });
    if (!ok) { handleMenuClose(); return; }
    try {
      await api.delete(`/fornecedores/${menuId}`);
      setRows((prev) => prev.filter((x) => x.id !== menuId));
      success("Fornecedor excluído com sucesso.");
    } catch {
      error("Não foi possível excluir o fornecedor.");
    } finally {
      handleMenuClose();
    }
  };

  const onSubmit = async (data: SupplierForm) => {
    try {
      if (mode === "create") {
        const { data: novo } = await api.post("/fornecedores", { ...data, oficina_id: oficinaId });
        setRows((p) => [novo, ...p]);
        success("Fornecedor cadastrado com sucesso!");
      } else if (current) {
        const { data: atualizado } = await api.put(`/fornecedores/${current.id}`, data);
        setRows((p) => p.map((r) => (r.id === current.id ? atualizado : r)));
        success("Fornecedor atualizado com sucesso!");
      }
      setOpenDialog(false);
    } catch (err) {
      console.error("Erro ao salvar fornecedor:", err);
      error("Não foi possível salvar o fornecedor.");
    }
  };

  const onDelete = async (id: string) => {
    try {
      await api.delete(`/fornecedores/${id}`);
      setRows((prev) => prev.filter((x) => x.id !== id));
      success("Fornecedor excluído com sucesso.");
    } catch {
      error("Não foi possível excluir o fornecedor.");
    }
  };

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return r.nome.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q) ||
      (r.telefone ?? "").includes(q) || (r.contato ?? "").toLowerCase().includes(q);
  });

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading) return <Box sx={{ textAlign: "center", mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4 } }}>
      <ModuleHeader
        title="Fornecedores"
        subtitle="Parceiros, contatos e base de compras da oficina."
        icon={<BusinessRoundedIcon />}
        metrics={[
          { label: "Cadastrados", value: rows.length, tone: "primary" },
          { label: "Com email", value: rows.filter((r) => !!r.email).length, tone: "success" },
          { label: "Filtrados", value: filtered.length, tone: "neutral" },
        ]}
        searchValue={query}
        searchPlaceholder="Pesquisar fornecedor, contato ou telefone"
        onSearchChange={setQuery}
        actionLabel="Novo Fornecedor"
        onAction={openCreate}
      />

      <Fade in timeout={400}>
        <ListTableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Contato</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Telefone</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.length > 0 ? paginated.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <BusinessRoundedIcon color="primary" />
                      <Typography fontWeight={600}>{s.nome}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{s.contato ?? "—"}</TableCell>
                  <TableCell>{s.email ? <Stack direction="row" spacing={1} alignItems="center"><EmailRoundedIcon sx={{ fontSize: 16, opacity: 0.7 }} />{s.email}</Stack> : "—"}</TableCell>
                  <TableCell>{s.telefone ? <Stack direction="row" spacing={1} alignItems="center"><PhoneRoundedIcon sx={{ fontSize: 16, opacity: 0.7 }} />{s.telefone}</Stack> : "—"}</TableCell>
                  <TableCell align="right">
                    <IconButton onClick={(e) => handleMenuOpen(e, s.id)}><MoreVertRoundedIcon /></IconButton>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 8, color: "text.secondary" }}>Nenhum fornecedor encontrado</TableCell></TableRow>
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

      <SupplierDialog open={openDialog} mode={mode} initial={current} onClose={() => setOpenDialog(false)}
        onSubmit={onSubmit} onDelete={(s) => onDelete(s.id)} />
    </Box>
  );
}
