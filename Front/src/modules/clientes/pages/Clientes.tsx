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
import { useListaPaginada } from "../../../hooks/useListaPaginada";
import ModuleHeader from "../../../components/layout/ModuleHeader";
import ListTableContainer from "../../../components/common/ListTableContainer";
import EmptyState from "../../../components/common/EmptyState";
import { IllustrationClientes } from "../../../components/common/Illustrations";

// ── helpers de mapeamento ──────────────────────────────────────────────────

function mapCliente(c: any): Client {
  return {
    id: String(c.id),
    nome: c.nome,
    email: c.email,
    cpf: c.cpf,
    telefone: c.telefone,
    observacao: c.observacao,
  };
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
  return { id: String(c.id), nome: c.nome, email: c.email, cpf: c.cpf, telefone: c.telefone, observacao: c.observacao };
}

async function atualizarCliente(id: string, data: ClientForm): Promise<Client> {
  const { data: c } = await api.put(`/clientes/${id}`, {
    nome: data.nome,
    email: data.email || null,
    cpf: data.cpf || null,
    telefone: data.telefone || null,
    observacao: data.observacao || null,
  });
  return { id: String(c.id), nome: c.nome, email: c.email, cpf: c.cpf, telefone: c.telefone, observacao: c.observacao };
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
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [menuClientId, setMenuClientId] = React.useState<string | null>(null);
  const { rows: rowsApi, total, carregandoInicial, page, setPage, rowsPerPage, setRowsPerPage, recarregar } =
    useListaPaginada<any>("/clientes", {
      filtros: { search: query },
      onError: (err) => {
        console.error("Erro ao carregar clientes:", err);
        error("Não foi possível carregar os clientes.");
      },
    });
  const rows = React.useMemo(() => rowsApi.map(mapCliente), [rowsApi]);

  const oficinaId = user?.oficina_id ?? 0;

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
      recarregar();
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
        setOpenDialog(false);
        success("Cliente cadastrado com sucesso!");
        navigate(`/clientes/${novo.id}`);
      } else if (current) {
        await atualizarCliente(current.id, data);
        recarregar();
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
      recarregar();
      success("Cliente excluído com sucesso.");
    } catch {
      error("Não foi possível excluir o cliente.");
    }
  };

  if (carregandoInicial) return <Box sx={{ textAlign: "center", mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>
      <ModuleHeader
        title="Clientes"
        subtitle="Cadastro, contato e histórico de relacionamento da oficina."
        icon={<GroupsRoundedIcon />}
        metrics={[
          { label: query.trim() ? "Encontrados" : "Cadastrados", value: total, tone: "primary" },
        ]}
        searchValue={query}
        searchPlaceholder="Pesquisar por nome, email ou telefone"
        onSearchChange={setQuery}
        actionLabel="Novo Cliente"
        onAction={openCreate}
      />

      <Fade in timeout={400}>
        <ListTableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Telefone</TableCell>
                <TableCell align="right" aria-label="Ações" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length > 0 ? rows.map((c) => (
                <TableRow
                  key={c.id}
                  hover
                  sx={{ height: 56, cursor: "pointer" }}
                  onDoubleClick={() => navigate(`/clientes/${c.id}`)}
                >
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: 14, fontWeight: 600 }}>
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
                <TableRow>
                  <TableCell colSpan={4} sx={{ border: 0 }}>
                    <EmptyState
                      illustration={<IllustrationClientes />}
                      icon={<GroupsRoundedIcon />}
                      title="Nenhum cliente cadastrado"
                      description="Cadastre o primeiro cliente para começar a gerenciar o relacionamento da oficina."
                      actionLabel="Novo Cliente"
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
        <MenuItem onClick={() => { if (menuClientId) navigate(`/clientes/${menuClientId}`); handleMenuClose(); }}>Ver detalhes</MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>Excluir</MenuItem>
      </Menu>

      <ClientDialog open={openDialog} mode={mode} initial={current} onClose={() => setOpenDialog(false)}
        onSubmit={onSubmit} onDelete={mode === "edit" ? () => onDelete(current?.id ?? "") : undefined} />
    </Box>
  );
}
