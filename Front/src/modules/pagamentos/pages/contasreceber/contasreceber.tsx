import * as React from "react";
import {
  Box, Stack, Typography, Paper, Button, IconButton, Chip, Tooltip,
  Table, TableBody, TableCell, TableHead, TableRow, TablePagination,
  Menu, MenuItem, Divider, Fade, CircularProgress, TextField, InputAdornment,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import SellRoundedIcon from "@mui/icons-material/SellRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../context/ToastContext";
import { useConfirm } from "../../../../context/ConfirmContext";
import ModuleHeader from "../../../../components/layout/ModuleHeader";
import ListTableContainer from "../../../../components/common/ListTableContainer";
import { AppDialog, AppDialogActions, AppDialogContent } from "../../../../components/common/AppDialog";
import api from "../../../../api/api";
import {
  type Conta, brl, isVencido, valorLiquido, valorRestante,
  METODO_LABEL, METODO_OPTIONS,
  listarPagamentos, criarPagamento, atualizarPagamento,
  marcarComoPago, registrarParcial, aplicarDesconto, renegociarPrazo,
  parcelar, cancelarPagamento,
} from "../../api/api";
import {
  PagarDialog, PagamentoParcialDialog, DescontoDialog, RenegociarDialog, ParcelarDialog,
} from "../../dialogs/index";

type Acao = "pagar" | "parcial" | "desconto" | "renegociar" | "parcelar" | "editar" | null;

function StatusChip({ conta }: { conta: Conta }) {
  if (isVencido(conta))
    return <Chip label="Vencido" size="small" color="error" sx={{ fontWeight: 700, fontSize: 11 }} />;
  if (conta.status === "parcial")
    return (
      <Chip
        label={`${brl(Number(conta.valor_pago))} de ${brl(valorLiquido(conta))}`}
        size="small"
        sx={{ bgcolor: (t) => alpha(t.palette.warning.main, 0.15), color: "warning.dark", fontWeight: 700, fontSize: 11 }}
      />
    );
  if (conta.status === "pago")
    return <Chip label="Recebido" size="small" color="success" sx={{ fontWeight: 700, fontSize: 11 }} />;
  if (conta.status === "cancelado")
    return <Chip label="Cancelado" size="small" sx={{ fontWeight: 700, fontSize: 11 }} />;
  return <Chip label="Pendente" size="small" color="warning" sx={{ fontWeight: 700, fontSize: 11 }} />;
}

export default function ContasReceber() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const confirm = useConfirm();

  const [contas, setContas] = React.useState<Conta[]>([]);
  const [clientes, setClientes] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selected, setSelected] = React.useState<Conta | null>(null);
  const [acao, setAcao] = React.useState<Acao>(null);
  const [dialogNova, setDialogNova] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  React.useEffect(() => {
    if (!user?.oficina_id) return;
    Promise.all([
      listarPagamentos(user.oficina_id),
      api.get("/clientes").then((r) => r.data).catch(() => []),
    ])
      .then(([pags, clts]) => {
        setContas(pags.filter((p) => p.tipo === "receber"));
        setClientes(clts);
      })
      .catch((err) => console.error("Erro ao carregar contas a receber:", err))
      .finally(() => setLoading(false));
  }, [user?.oficina_id]);

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, conta: Conta) => {
    setAnchorEl(e.currentTarget); setSelected(conta);
  };
  const handleMenuClose = () => { setAnchorEl(null); };
  const openAcao = (a: Acao) => { setAcao(a); handleMenuClose(); };
  const handleReceberDireto = (conta: Conta) => { setSelected(conta); setAcao("pagar"); };

  const handleAcao = async (fn: () => Promise<any>, msg: string) => {
    try {
      const result = await fn();
      if (result?.parcelas) {
        setContas((prev) => [
          ...result.parcelas,
          ...prev.filter((c) => c.id !== selected?.id),
        ]);
      } else if (result?.id) {
        setContas((prev) => prev.map((c) => (c.id === result.id ? result : c)));
      }
      success(msg);
      setAcao(null);
    } catch (err: any) {
      error(err?.response?.data?.message ?? "Erro ao processar ação.");
    }
  };

  const handleCancelar = async () => {
    if (!selected) return;
    handleMenuClose();
    const ok = await confirm({
      title: "Cancelar título?",
      message: "O título será marcado como cancelado e não aparecerá mais como pendente.",
      confirmLabel: "Sim, cancelar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await cancelarPagamento(selected.id);
      setContas((prev) => prev.filter((c) => c.id !== selected.id));
      success("Título cancelado.");
    } catch {
      error("Não foi possível cancelar o título.");
    }
  };

  // ── Cards de resumo ──────────────────────────────────────────────────────────
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const totalAberto = contas
    .filter((c) => c.status === "pendente" || c.status === "parcial")
    .reduce((s, c) => s + valorRestante(c), 0);

  const recebidoMes = contas
    .filter((c) => c.status === "pago" && c.data_pagamento && new Date(c.data_pagamento) >= inicioMes)
    .reduce((s, c) => s + valorLiquido(c), 0);

  const totalVencidos = contas
    .filter(isVencido)
    .reduce((s, c) => s + valorRestante(c), 0);

  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const aVencer = contas
    .filter((c) => (c.status === "pendente" || c.status === "parcial") &&
      new Date(c.data_vencimento) >= hoje && new Date(c.data_vencimento) <= fimMes)
    .reduce((s, c) => s + valorRestante(c), 0);

  const resumo = [
    { label: "Total a receber",  value: brl(totalAberto),   icon: <TrendingUpRoundedIcon />,     tone: "primary" },
    { label: "Recebido no mês",  value: brl(recebidoMes),   icon: <CheckCircleRoundedIcon />,    tone: "success" },
    { label: "Vencidos",         value: brl(totalVencidos), icon: <ErrorOutlineRoundedIcon />,   tone: "error" },
    { label: "A vencer (mês)",   value: brl(aVencer),       icon: <ScheduleRoundedIcon />,       tone: "warning" },
  ] as const;

  // ── Filtro ──────────────────────────────────────────────────────────────────
  const filtered = contas.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.descricao ?? "").toLowerCase().includes(q) ||
      (c.cliente?.nome ?? "").toLowerCase().includes(q) ||
      (c.categoria ?? "").toLowerCase().includes(q)
    );
  });
  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading) return <Box sx={{ textAlign: "center", mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4 } }}>
      <ModuleHeader
        title="Contas a Receber"
        subtitle="Gerencie recebimentos de clientes e serviços prestados."
        icon={<TrendingUpRoundedIcon />}
        metrics={[
          { label: "Total",    value: contas.length,                                       tone: "primary" },
          { label: "Vencidos", value: contas.filter(isVencido).length,                     tone: "error" },
          { label: "Pendentes", value: contas.filter((c) => c.status === "pendente").length, tone: "neutral" },
        ]}
        searchValue={query}
        searchPlaceholder="Pesquisar por descrição, cliente ou categoria"
        onSearchChange={setQuery}
        actionLabel="Nova Conta"
        onAction={() => setDialogNova(true)}
      />

      {/* Cards */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={3}>
        {resumo.map((r) => (
          <Paper key={r.label} elevation={0} sx={{
            flex: 1, p: 2, borderRadius: 2.5,
            border: (t) => `1px solid ${t.palette.divider}`,
          }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
              <Box sx={{ color: `${r.tone}.main`, display: "flex", fontSize: 18 }}>{r.icon}</Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>{r.label}</Typography>
            </Stack>
            <Typography variant="h6" fontWeight={800} color={`${r.tone}.main`}>{r.value}</Typography>
          </Paper>
        ))}
      </Stack>

      {/* Tabela */}
      <Fade in timeout={400}>
        <ListTableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Responsável</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell>Valor</TableCell>
                <TableCell>Vencimento</TableCell>
                <TableCell>Método</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.length > 0 ? paginated.map((conta) => {
                const vencido = isVencido(conta);
                const liquido = valorLiquido(conta);
                const restante = valorRestante(conta);
                return (
                  <TableRow
                    key={conta.id} hover
                    sx={{
                      height: 56,
                      bgcolor: vencido ? (t) => alpha(t.palette.error.main, 0.04) : undefined,
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {conta.cliente?.nome ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {conta.descricao ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Typography
                          variant="body2" fontWeight={700}
                          color={conta.status === "pago" ? "success.main" : vencido ? "error.main" : "text.primary"}
                        >
                          {brl(liquido)}
                        </Typography>
                        {conta.total_parcelas && conta.total_parcelas > 1 && (
                          <Chip
                            label={`${conta.parcela_numero ?? 1}/${conta.total_parcelas}`}
                            size="small"
                            sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                          />
                        )}
                        {conta.desconto > 0 && (
                          <Tooltip title={`Desconto de ${brl(Number(conta.desconto))}: ${conta.motivo_desconto ?? ""}`}>
                            <SellRoundedIcon sx={{ fontSize: 13, color: "success.main" }} />
                          </Tooltip>
                        )}
                      </Stack>
                      {conta.status === "parcial" && (
                        <Typography variant="caption" color="text.disabled">
                          {brl(Number(conta.valor_pago))} recebidos · {brl(restante)} restante
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography variant="body2" color={vencido ? "error.main" : "text.primary"} fontWeight={vencido ? 700 : 400}>
                          {new Date(conta.data_vencimento).toLocaleDateString("pt-BR")}
                        </Typography>
                        {conta.vezes_renegociado > 0 && (
                          <Tooltip title={`Data original: ${conta.data_vencimento_original ? new Date(conta.data_vencimento_original).toLocaleDateString("pt-BR") : "—"} · Renegociado ${conta.vezes_renegociado}×`}>
                            <EventRepeatRoundedIcon sx={{ fontSize: 13, color: "warning.main", cursor: "help" }} />
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {conta.metodo ? (METODO_LABEL[conta.metodo] ?? conta.metodo) : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell><StatusChip conta={conta} /></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Marcar como recebido">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleReceberDireto(conta)}
                              disabled={conta.status === "pago" || conta.status === "cancelado"}
                              sx={{ color: "success.main" }}
                            >
                              <CheckCircleRoundedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <IconButton size="small" aria-label="Mais ações" onClick={(e) => handleMenuOpen(e, conta)}>
                          <MoreVertRoundedIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8, color: "text.secondary" }}>
                    Nenhuma conta encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ListTableContainer>
      </Fade>

      <TablePagination
        component="div" count={filtered.length} page={page}
        onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[5, 10, 20]} labelRowsPerPage="Linhas por página:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `mais de ${to}`}`}
        sx={{ mt: 1.5, borderRadius: 2, bgcolor: "background.paper" }}
      />

      {/* Menu 3-pontos */}
      <Menu
        anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={() => openAcao("parcial")} disabled={selected?.status === "pago" || selected?.status === "cancelado"}>
          <PaymentsRoundedIcon fontSize="small" sx={{ mr: 1.5, color: "warning.main" }} />Recebimento parcial
        </MenuItem>
        <MenuItem onClick={() => openAcao("desconto")} disabled={selected?.status === "pago" || selected?.status === "cancelado"}>
          <SellRoundedIcon fontSize="small" sx={{ mr: 1.5, color: "info.main" }} />Dar desconto
        </MenuItem>
        <MenuItem onClick={() => openAcao("renegociar")} disabled={selected?.status === "pago" || selected?.status === "cancelado"}>
          <EventRepeatRoundedIcon fontSize="small" sx={{ mr: 1.5, color: "secondary.main" }} />Renegociar prazo
        </MenuItem>
        <MenuItem onClick={() => openAcao("parcelar")} disabled={selected?.status !== "pendente"}>
          <AccountTreeRoundedIcon fontSize="small" sx={{ mr: 1.5 }} />Parcelar
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => openAcao("editar")}>
          <EditRoundedIcon fontSize="small" sx={{ mr: 1.5 }} />Editar
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleCancelar} sx={{ color: "error.main" }}>
          <BlockRoundedIcon fontSize="small" sx={{ mr: 1.5 }} />Cancelar título
        </MenuItem>
      </Menu>

      {/* Dialogs de ação */}
      <PagarDialog
        open={acao === "pagar"}
        onClose={() => setAcao(null)}
        onConfirm={(d) => handleAcao(() => marcarComoPago(selected!.id, d), "Recebimento confirmado!")}
      />
      <PagamentoParcialDialog
        open={acao === "parcial"}
        onClose={() => setAcao(null)}
        saldoRestante={selected ? valorRestante(selected) : 0}
        onConfirm={(d) => handleAcao(() => registrarParcial(selected!.id, d), "Entrada registrada!")}
      />
      <DescontoDialog
        open={acao === "desconto"}
        onClose={() => setAcao(null)}
        valorOriginal={selected ? Number(selected.valor_original) : 0}
        onConfirm={(d) => handleAcao(() => aplicarDesconto(selected!.id, d), "Desconto aplicado!")}
      />
      <RenegociarDialog
        open={acao === "renegociar"}
        onClose={() => setAcao(null)}
        onConfirm={(d) => handleAcao(() => renegociarPrazo(selected!.id, d), "Prazo renegociado!")}
      />
      <ParcelarDialog
        open={acao === "parcelar"}
        onClose={() => setAcao(null)}
        valorOriginal={selected ? valorLiquido(selected) : 0}
        onConfirm={(d) => handleAcao(() => parcelar(selected!.id, d), "Título parcelado!")}
      />

      {/* Dialog editar */}
      <EditarDialog
        open={acao === "editar"}
        conta={selected}
        onClose={() => setAcao(null)}
        onConfirm={(d) => handleAcao(() => atualizarPagamento(selected!.id, d), "Conta atualizada!")}
      />

      {/* Dialog nova conta */}
      <NovaContaReceberDialog
        open={dialogNova}
        onClose={() => setDialogNova(false)}
        clientes={clientes}
        onConfirm={async (payload) => {
          try {
            const nova = await criarPagamento({ ...payload, tipo: "receber", oficina_id: user?.oficina_id });
            setContas((prev) => [nova, ...prev]);
            setDialogNova(false);
            success("Conta cadastrada!");
          } catch {
            error("Não foi possível cadastrar a conta.");
          }
        }}
      />
    </Box>
  );
}

// ── Dialog editar ─────────────────────────────────────────────────────────────

function EditarDialog({ open, conta, onClose, onConfirm }: {
  open: boolean; conta: Conta | null; onClose: () => void;
  onConfirm: (data: any) => void;
}) {
  const [descricao, setDescricao] = React.useState("");
  const [categoria, setCategoria] = React.useState("");
  const [observacao, setObservacao] = React.useState("");

  React.useEffect(() => {
    if (open && conta) {
      setDescricao(conta.descricao ?? "");
      setCategoria(conta.categoria ?? "");
      setObservacao(conta.observacao ?? "");
    }
  }, [open, conta]);

  return (
    <AppDialog open={open} onClose={onClose} onCloseClick={onClose} closeOnBackdrop={false} closeOnEscape={false} maxWidth="xs" title="Editar conta" icon={<EditRoundedIcon />} variant="entity">
      <AppDialogContent>
        <Stack spacing={2}>
          <TextField label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} size="small" fullWidth />
          <TextField label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} size="small" fullWidth />
          <TextField label="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} size="small" fullWidth multiline rows={2} />
        </Stack>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 999 }}>Cancelar</Button>
        <Button variant="contained" disableElevation sx={{ textTransform: "none", borderRadius: 999 }}
          onClick={() => onConfirm({ descricao, categoria, observacao })}>
          Salvar
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}

// ── Dialog nova conta a receber ───────────────────────────────────────────────

function NovaContaReceberDialog({ open, onClose, clientes, onConfirm }: {
  open: boolean; onClose: () => void; clientes: any[];
  onConfirm: (data: any) => void;
}) {
  const [form, setForm] = React.useState({ descricao: "", valor: "", data_vencimento: "", metodo: "pix", cliente_id: "", categoria: "", observacao: "" });
  const set = (field: string, v: string) => setForm((p) => ({ ...p, [field]: v }));

  React.useEffect(() => {
    if (open) setForm({ descricao: "", valor: "", data_vencimento: "", metodo: "pix", cliente_id: "", categoria: "", observacao: "" });
  }, [open]);

  const valido = form.descricao.trim() && parseFloat(form.valor) > 0 && form.data_vencimento;

  return (
    <AppDialog open={open} onClose={onClose} onCloseClick={onClose} closeOnBackdrop={false} closeOnEscape={false} maxWidth="sm" title="Nova conta a receber" icon={<TrendingUpRoundedIcon />} variant="entity">
      <AppDialogContent>
        <Stack spacing={2}>
          <TextField select label="Cliente (opcional)" value={form.cliente_id} onChange={(e) => set("cliente_id", e.target.value)} size="small" fullWidth>
            <MenuItem value="">Sem cliente</MenuItem>
            {clientes.map((c) => <MenuItem key={c.id} value={c.id}>{c.nome}</MenuItem>)}
          </TextField>
          <TextField label="Descrição *" value={form.descricao} onChange={(e) => set("descricao", e.target.value)} size="small" fullWidth />
          <TextField label="Categoria" value={form.categoria} onChange={(e) => set("categoria", e.target.value)} size="small" fullWidth />
          <TextField label="Valor *" type="number" value={form.valor} onChange={(e) => set("valor", e.target.value)} size="small" fullWidth InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }} />
          <TextField label="Vencimento *" type="date" value={form.data_vencimento} onChange={(e) => set("data_vencimento", e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} />
          <TextField select label="Método" value={form.metodo} onChange={(e) => set("metodo", e.target.value)} size="small" fullWidth>
            {METODO_OPTIONS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>
          <TextField label="Observação" value={form.observacao} onChange={(e) => set("observacao", e.target.value)} size="small" fullWidth multiline rows={2} />
        </Stack>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 999 }}>Cancelar</Button>
        <Button variant="contained" disableElevation disabled={!valido} sx={{ textTransform: "none", borderRadius: 999 }}
          onClick={() => onConfirm({ ...form, valor: parseFloat(form.valor), cliente_id: form.cliente_id ? Number(form.cliente_id) : null, status: "pendente" })}>
          Salvar
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}
