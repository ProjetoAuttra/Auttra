import * as React from "react";
import {
  Box, Stack, Typography, TextField, InputAdornment, Button, IconButton,
  Avatar, Chip, Menu, MenuItem, Fade, Table, TableBody, TableCell,
  TableHead, TableRow, TablePagination, Divider, } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { useConfirm } from "../../../context/ConfirmContext";
import FuncionarioDialog, { type FuncionarioForm } from "../dialog";
import { AppDialog, AppDialogActions, AppDialogContent } from "../../../components/common/AppDialog";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import { listarFuncionarios, criarFuncionario, atualizarFuncionario, deletarFuncionario } from "../api/api";
import ListTableContainer from "../../../components/common/ListTableContainer";
import ModuleHeader from "../../../components/layout/ModuleHeader";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import LinhasEsqueleto from "../../../components/common/LinhasEsqueleto";

type Funcionario = {
  id: number;
  nome: string;
  email?: string;
  cargo?: string;
  telefone?: string;
  data_contratacao?: string;
  perfil_acesso_id?: number;
};

export default function FuncionariosPage() {
  const { user, can } = useAuth();
  const { success, error, warning } = useToast();
  const confirm = useConfirm();

  const [rows, setRows] = React.useState<Funcionario[]>([]);
  const [query, setQuery] = React.useState("");
  const [openDialog, setOpenDialog] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [current, setCurrent] = React.useState<Funcionario | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [menuId, setMenuId] = React.useState<number | null>(null);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  React.useEffect(() => {
    listarFuncionarios()
      .then(setRows)
      .catch((err) => console.error("Erro ao carregar funcionários:", err))
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => { setMode("create"); setCurrent(null); setOpenDialog(true); };
  const openEdit = (f: Funcionario) => { setMode("edit"); setCurrent(f); setOpenDialog(true); };
  const handleMenuOpen = (e: React.MouseEvent<HTMLButtonElement>, id: number) => { setAnchorEl(e.currentTarget); setMenuId(id); };
  const handleMenuClose = () => { setAnchorEl(null); setMenuId(null); };
  const handleEdit = () => { const f = rows.find((r) => r.id === menuId); if (f) openEdit(f); handleMenuClose(); };

  const handleDelete = async () => {
    if (!menuId) return;
    const ok = await confirm({
      title: "Excluir funcionário?",
      message: "O acesso deste funcionário ao sistema será removido.",
      confirmLabel: "Sim, excluir",
      variant: "danger",
    });
    if (!ok) { handleMenuClose(); return; }
    try {
      await deletarFuncionario(menuId);
      setRows((prev) => prev.filter((r) => r.id !== menuId));
      success("Funcionário excluído com sucesso.");
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.response?.data?.message ?? "Não foi possível excluir o funcionário.";
      error(msg);
    } finally {
      handleMenuClose();
    }
  };

  // Link do convite para o gestor repassar quando o e-mail não sai.
  const [conviteLink, setConviteLink] = React.useState<string | null>(null);

  const avisarCadastro = (novo: any, email: string) => {
    if (novo?.conta_existente) {
      success("Funcionário cadastrado. Ele já tem conta no Auttra e entra com a senha que já usa.");
    } else if (novo?.convite_enviado === true) {
      success(`Funcionário cadastrado. Enviamos um convite para ${email} criar a senha.`);
    } else if (novo?.convite_enviado === false) {
      warning("Funcionário cadastrado, mas o e-mail de convite não foi enviado. Copie o link e envie para ele.");
      setConviteLink(novo.convite_link ?? null);
    } else {
      success("Funcionário cadastrado com sucesso!");
    }
  };

  const copiarConvite = async () => {
    if (!conviteLink) return;
    try {
      await navigator.clipboard.writeText(conviteLink);
      success("Link copiado.");
    } catch {
      error("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  };

  const onSubmit = async (data: FuncionarioForm) => {
    try {
      if (mode === "create") {
        const novo = await criarFuncionario(data);
        setRows((p) => [novo, ...p]);
        avisarCadastro(novo, data.email);
      } else if (current) {
        const atualizado = await atualizarFuncionario(current.id, data);
        setRows((p) => p.map((r) => (r.id === current.id ? atualizado : r)));
        success("Funcionário atualizado com sucesso!");
      }
      setOpenDialog(false);
    } catch (err: any) {
      console.error("Erro ao salvar funcionário:", err);
      const msg = err?.response?.data?.error ?? err?.response?.data?.message ?? "Não foi possível salvar o funcionário.";
      error(msg);
    }
  };

  const CARGO_COLOR: Record<string, "default" | "primary" | "warning" | "error"> = {
    mecanico: "primary", atendente: "default", gerente: "warning", administrador: "error",
  };
  const CARGO_LABEL: Record<string, string> = {
    mecanico: "Mecânico", atendente: "Atendente", gerente: "Gerente", administrador: "Administrador",
  };

  const filtered = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return r.nome.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q) || (r.cargo ?? "").toLowerCase().includes(q);
  });

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);


  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>
      <ModuleHeader
        title="Funcionários"
        subtitle="Gerencie os funcionários cadastrados na sua oficina"
        icon={<BadgeRoundedIcon />}
        actions={
          <Stack direction="row" spacing={1.5}>
            <TextField value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar funcionário" size="small"
              sx={{ minWidth: 300 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }}
            />
            {can("funcionarios", "create") && <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Funcionário
            </Button>}
          </Stack>
        }
      />

      <Fade in timeout={400}>
        <ListTableContainer sx={{ height: "auto" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Cargo</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Telefone</TableCell>
                <TableCell align="right" aria-label="Ações" />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? <LinhasEsqueleto colunas={5} /> : paginated.length > 0 ? paginated.map((f) => (
                <TableRow key={f.id} hover sx={{ height: 56 }}>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: 14, fontWeight: 600 }}>
                        {f.nome[0].toUpperCase()}
                      </Avatar>
                      <Typography fontWeight={600}>{f.nome}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip label={CARGO_LABEL[f.cargo?.toLowerCase() ?? ""] ?? f.cargo ?? "—"} size="small" color={CARGO_COLOR[f.cargo?.toLowerCase() ?? ""] ?? "default"} sx={{ fontWeight: 600 }} />
                  </TableCell>
                  <TableCell>{f.email || "—"}</TableCell>
                  <TableCell>{f.telefone || "—"}</TableCell>
                  <TableCell align="right">
                    {(can("funcionarios", "update") || can("funcionarios", "delete")) && (
                      <IconButton aria-label="Mais ações" onClick={(e) => handleMenuOpen(e, f.id)}><MoreVertRoundedIcon /></IconButton>
                    )}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 8, color: "text.secondary" }}>Nenhum funcionário encontrado</TableCell></TableRow>
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
        sx={{ bgcolor: "transparent", borderTop: (t) => `1px solid ${t.palette.divider}` }}
      />

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
        {can("funcionarios", "update") && <MenuItem onClick={handleEdit}><EditRoundedIcon fontSize="small" sx={{ mr: 1 }} /> Editar</MenuItem>}
        {can("funcionarios", "delete") && <Divider />}
        {can("funcionarios", "delete") && <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}><DeleteRoundedIcon fontSize="small" sx={{ mr: 1 }} /> Excluir</MenuItem>}
      </Menu>

      <FuncionarioDialog open={openDialog} mode={mode} initial={current} onClose={() => setOpenDialog(false)}
        onSubmit={onSubmit} oficina_id={user?.oficina_id ?? 0} />

      <AppDialog
        open={!!conviteLink}
        onClose={() => setConviteLink(null)}
        onCloseClick={() => setConviteLink(null)}
        confirmDiscard={false}
        title="Link de convite"
        icon={<LinkRoundedIcon />}
        maxWidth="sm"
        fullWidth
      >
        <AppDialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            O e-mail não foi enviado. Mande este link para o funcionário (WhatsApp, por exemplo): ele abre a
            página para criar a senha. O link vale por 7 dias e só pode ser usado uma vez.
          </Typography>
          <TextField
            value={conviteLink ?? ""}
            fullWidth
            size="small"
            InputProps={{ readOnly: true }}
            inputProps={{ "aria-label": "Link de convite" }}
            onFocus={(e) => e.target.select()}
          />
        </AppDialogContent>
        <AppDialogActions>
          <Button onClick={() => setConviteLink(null)}>Fechar</Button>
          <Button variant="contained" disableElevation startIcon={<ContentCopyRoundedIcon />} onClick={copiarConvite}>
            Copiar link
          </Button>
        </AppDialogActions>
      </AppDialog>
    </Box>
  );
}
