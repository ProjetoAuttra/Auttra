import * as React from "react";
import {
  Box, Stack, Typography, IconButton,
  Avatar, Menu, MenuItem, Divider, Fade, Table, TableBody,
  TableCell, TableHead, TableRow, TablePagination, CircularProgress,
} from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { useConfirm } from "../../../context/ConfirmContext";
import ClientDialog, { type Client, type ClientForm } from "../dialog";
import api from "../../../api/api";
import ModuleHeader from "../../../components/layout/ModuleHeader";
import ListTableContainer from "../../../components/common/ListTableContainer";

// ── helpers de mapeamento ──────────────────────────────────────────────────

async function listarClientes(): Promise<Client[]> {
  const { data } = await api.get("/clientes");
  return data.map((c: any) => ({
    id: String(c.id),
    nome: c.nome,
    email: c.email,
    telefone: c.telefone,
    observacao: c.observacao,
  }));
}

async function criarCliente(data: ClientForm, oficinaId: number): Promise<Client> {
  const payload = {
    nome: data.nome,
    email: data.email || null,
    cpf: data.cpf || null,
    telefone: data.telefone || null,
    data_nascimento: data.data_nascimento ? new Date(data.data_nascimento).toISOString() : null,
    observacao: data.observacao || null,
    oficina_id: oficinaId,
  };
  const { data: c } = await api.post("/clientes", payload);
  return { id: String(c.id), nome: c.nome, email: c.email, telefone: c.telefone, observacao: c.observacao };
}

async function atualizarCliente(id: string, data: ClientForm): Promise<Client> {
  const { data: c } = await api.put(`/clientes/${id}`, {
    nome: data.nome,
    email: data.email || null,
    cpf: data.cpf || null,
    telefone: data.telefone || null,
    observacao: data.observacao || null,
  });
  return { id: String(c.id), nome: c.nome, email: c.email, telefone: c.telefone, observacao: c.observacao };
}

async function excluirCliente(id: string): Promise<void> {
  await api.delete(`/clientes/${id}`);
}

// ── Componente ─────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const { user } = useAuth();
  const { success, error, warning } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [query, setQuery] = React.useState("");
  const [openDialog, setOpenDialog] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [current, setCurrent] = React.useState<Client | null>(null);
  const [rows, setRows] = React.useState<Client[]>([]);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [menuClientId, setMenuClientId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  const oficinaId = user?.oficina_id ?? 0;

  React.useEffect(() => {
    listarClientes()
      .then(setRows)
      .catch((err) => console.error("Erro ao carregar clientes:", err))
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => { setMode("create"); setCurrent(null); setOpenDialog(true); };
  const handleMenuOpen = (e: React.MouseEvent<HTMLButtonElement>, id: string) => { setAnchorEl(e.currentTarget); setMenuClientId(id); };
  const handleMenuClose = () => { setAnchorEl(null); setMenuClientId(null); };

  const handleDelete = async () => {
    const cliente = rows.find((r) => r.id === menuClientId);
    if (!cliente) return;
    const ok = await confirm({
      title: `Excluir ${cliente.nome}?`,
      message: "O histórico de ordens e pagamentos será mantido.",
      confirmLabel: "Sim, excluir",
      variant: "danger",
    });
    if (!ok) { handleMenuClose(); return; }
    try {
      await excluirCliente(cliente.id);
      setRows((p) => p.filter((x) => x.id !== cliente.id));
      success("Cliente excluído com sucesso.");
    } catch {
      error("Não foi possível excluir o cliente.");
    } finally {
      handleMenuClose();
    }
  };

  const onSubmit = async (data: ClientForm) => {
    try {
      if (mode === "create") {
        if (!oficinaId) { warning("Usuário sem oficina vinculada. Faça login novamente."); return; }
        const novo = await criarCliente(data, oficinaId);
        setRows((p) => [novo, ...p]);
        setOpenDialog(false);
        success("Cliente cadastrado com sucesso!");
      } else if (current) {
        const atualizado = await atualizarCliente(current.id, data);
        setRows((p) => p.map((r) => (r.id === current.id ? atualizado : r)));
        setOpenDialog(false);
        success("Cliente atualizado com sucesso!");
      }
    } catch (err) {
      console.error("Erro ao salvar cliente:", err);
      error("Não foi possível salvar o cliente.");
    }
  };

  const onDelete = async (id: string) => {
    try {
      await excluirCliente(id);
      setRows((p) => p.filter((x) => x.id !== id));
      success("Cliente excluído com sucesso.");
    } catch {
      error("Não foi possível excluir o cliente.");
    }
  };

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return r.nome.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q) ||
      (r.telefone ?? "").includes(q.replace(/[^\d]/g, ""));
  });

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading) return <Box sx={{ textAlign: "center", mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>
      <ModuleHeader
        title="Clientes"
        subtitle="Cadastro, contato e histórico de relacionamento da oficina."
        icon={<GroupsRoundedIcon />}
        metrics={[
          { label: "Cadastrados", value: rows.length, tone: "primary" },
          { label: "Filtrados", value: filtered.length, tone: "neutral" },
        ]}
        searchValue={query}
        searchPlaceholder="Pesquisar por nome, email ou telefone"
        onSearchChange={setQuery}
        actionLabel="Novo Cliente"
        onAction={openCreate}
      />

      <Fade in timeout={400}>
        <ListTableContainer sx={{ borderRadius: 3 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Telefone</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.length > 0 ? paginated.map((c) => (
                <TableRow
                  key={c.id}
                  hover
                  sx={{ height: 56, cursor: "pointer" }}
                  onDoubleClick={() => navigate(`/clientes/${c.id}`)}
                >
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: 14, fontWeight: 700 }}>
                        {c.nome[0].toUpperCase()}
                      </Avatar>
                      <Typography fontWeight={600}>{c.nome}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{c.email || "—"}</TableCell>
                  <TableCell>{c.telefone || "—"}</TableCell>
                  <TableCell align="right">
                    <IconButton onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, c.id); }}>
                      <MoreVertRoundedIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 8, color: "text.secondary" }}>Nenhum cliente encontrado</TableCell></TableRow>
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
        sx={{ mt: 1.5, borderRadius: 3, bgcolor: "background.paper", border: (t) => `1px solid ${t.palette.divider}` }}
      />

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
        <MenuItem onClick={() => { if (menuClientId) navigate(`/clientes/${menuClientId}`); handleMenuClose(); }}>Ver detalhes</MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>Excluir</MenuItem>
      </Menu>

      <ClientDialog open={openDialog} mode={mode} initial={current} onClose={() => setOpenDialog(false)}
        onSubmit={onSubmit} onDelete={mode === "edit" ? () => onDelete(current?.id ?? "") : undefined} />
    </Box>
  );
}
