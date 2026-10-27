import * as React from "react";
import {
  Box, Stack, Typography, Button, IconButton, Chip, Tooltip,
  Table, TableBody, TableCell, TableHead, TableRow, TablePagination,
  Menu, MenuItem, Divider, Fade, CircularProgress, TextField, InputAdornment,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import SellRoundedIcon from "@mui/icons-material/SellRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../context/ToastContext";
import { useConfirm } from "../../../../context/ConfirmContext";
import { useListaPaginada } from "../../../../hooks/useListaPaginada";
import ModuleHeader from "../../../../components/layout/ModuleHeader";
import StatCard, { StatGroup } from "../../../../components/common/StatCard";
import EmptyState from "../../../../components/common/EmptyState";
import ListTableContainer from "../../../../components/common/ListTableContainer";
import { AppDialog, AppDialogActions, AppDialogContent } from "../../../../components/common/AppDialog";
import api from "../../../../api/api";
import { type Conta, brl, isVencido, valorLiquido, valorRestante, METODO_LABEL, METODO_OPTIONS, criarPagamento, atualizarPagamento, marcarComoPago, estornarPagamento, aplicarDesconto, renegociarPrazo, parcelar, cancelarPagamento, resumoPagamentos, type ResumoContas } from "../../api/api";
import {
  ReceberDialog, EstornarDialog, MovimentosDialog, DescontoDialog, RenegociarDialog, ParcelarDialog,
} from "../../dialogs/index";

type Acao = "pagar" | "estornar" | "historico" | "desconto" | "renegociar" | "parcelar" | "editar" | null;

function StatusChip({ conta }: { conta: Conta }) {
  if (isVencido(conta))
    return <Chip label="Vencido" size="small" color="error" sx={{ fontWeight: 600, fontSize: 12 }} />;
  if (conta.status === "pago")
    return <Chip label="Pago" size="small" color="success" sx={{ fontWeight: 600, fontSize: 12 }} />;
  if (conta.status === "cancelado")
    return <Chip label="Cancelado" size="small" sx={{ fontWeight: 600, fontSize: 12 }} />;
  return <Chip label="Pendente" size="small" color="warning" sx={{ fontWeight: 600, fontSize: 12 }} />;
}

export default function ContasPagar() {
  const { user, can } = useAuth();
  const { success, error } = useToast();
  const confirm = useConfirm();

  const [fornecedores, setFornecedores] = React.useState<any[]>([]);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selected, setSelected] = React.useState<Conta | null>(null);
  const [acao, setAcao] = React.useState<Acao>(null);
  const [dialogNova, setDialogNova] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const { rows: contas, total, carregandoInicial, page, setPage, rowsPerPage, setRowsPerPage, recarregar } =
    useListaPaginada<Conta>("/pagamentos", {
      filtros: { tipo: "pagar", search: query },
      onError: (err) => console.error("Erro ao carregar contas:", err),
    });
  const [resumoApi, setResumoApi] = React.useState<ResumoContas | null>(null);
  const carregarResumo = React.useCallback(() => {
    resumoPagamentos("pagar").then(setResumoApi).catch((err) => console.error("Erro ao carregar resumo:", err));
  }, []);
  React.useEffect(() => { carregarResumo(); }, [carregarResumo]);
  const recarregarTudo = () => { recarregar(); carregarResumo(); };

  React.useEffect(() => {
    if (!user?.oficina_id) return;
    api.get("/fornecedores").then((r) => r.data).catch(() => []).then(setFornecedores);
  }, [user?.oficina_id]);

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, conta: Conta) => {
    setAnchorEl(e.currentTarget); setSelected(conta);
  };
  const handleMenuClose = () => { setAnchorEl(null); };
  const openAcao = (a: Acao) => { setAcao(a); handleMenuClose(); };
  const handlePagarDireto = (conta: Conta) => { setSelected(conta); setAcao("pagar"); };

  const handleAcao = async (fn: () => Promise<any>, msg: string | ((result: any) => string)) => {
    try {
      const result = await fn();
      recarregarTudo();
      success(typeof msg === "function" ? msg(result) : msg);
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
      recarregarTudo();
      success("Título cancelado.");
    } catch (err: any) {
      error(err?.response?.data?.message ?? "Não foi possível cancelar o título.");
    }
  };

  // ── Cards de resumo ──────────────────────────────────────────────────────────
  const totalAberto = resumoApi?.total_aberto ?? 0;
  const pagoNomes = resumoApi?.pago_mes ?? 0;
  const totalVencidos = resumoApi?.vencidos ?? 0;
  const aVencer = resumoApi?.a_vencer ?? 0;

  const resumo = [
    { label: "Total a pagar",  value: brl(totalAberto),  icon: <TrendingDownRoundedIcon />, tone: "error" },
    { label: "Pago no mês",    value: brl(pagoNomes),    icon: <CheckCircleRoundedIcon />,  tone: "success" },
    { label: "Vencidos",       value: brl(totalVencidos), icon: <ErrorOutlineRoundedIcon />, tone: "error" },
    { label: "A vencer (mês)", value: brl(aVencer),      icon: <ScheduleRoundedIcon />,     tone: "warning" },
  ] as const;

  if (carregandoInicial) return <Box sx={{ textAlign: "center", mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>
      <ModuleHeader
        title="Contas a Pagar"
        subtitle="Gerencie pagamentos a fornecedores e despesas da oficina."
        icon={<TrendingDownRoundedIcon />}
        metrics={[
          { label: "Total",    value: resumoApi?.qtd_total ?? 0,                                       tone: "primary" },
          { label: "Vencidos", value: resumoApi?.qtd_vencidos ?? 0,                     tone: "error" },
          { label: "Pendentes", value: resumoApi?.qtd_pendentes ?? 0, tone: "neutral" },
        ]}
        searchValue={query}
        searchPlaceholder="Pesquisar por descrição, fornecedor ou categoria"
        onSearchChange={setQuery}
        actionLabel="Nova Conta"
        onAction={() => setDialogNova(true)}
      />

      {/* Cards */}
      <StatGroup>
        {resumo.map((r) => (
          <StatCard key={r.label} label={r.label} value={r.value} icon={r.icon} tone={r.tone} />
        ))}
      </StatGroup>

      {/* Tabela */}
      <Fade in timeout={400}>
        <ListTableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Fornecedor</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell>Valor</TableCell>
                <TableCell>Vencimento</TableCell>
                <TableCell>Método</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contas.length > 0 ? contas.map((conta) => {
                const vencido = isVencido(conta);
                const liquido = valorLiquido(conta);
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
                        {conta.fornecedor?.nome ?? "—"}
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
                          variant="body2" fontWeight={600}
                          color={conta.status === "pago" ? "success.main" : vencido ? "error.main" : "text.primary"}
                        >
                          {brl(liquido)}
                        </Typography>
                        {conta.total_parcelas && conta.total_parcelas > 1 && (
                          <Chip
                            label={`${conta.parcela_numero ?? 1}/${conta.total_parcelas}`}
                            size="small"
                            sx={{ height: 18, fontSize: 12, fontWeight: 600 }}
                          />
                        )}
                        {conta.desconto > 0 && (
                          <Tooltip title={`Desconto de ${brl(Number(conta.desconto))}: ${conta.motivo_desconto ?? ""}`}>
                            <SellRoundedIcon sx={{ fontSize: 13, color: "success.main" }} />
                          </Tooltip>
                        )}
                      </Stack>
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
                        <Tooltip title="Pagar">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handlePagarDireto(conta)}
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
                  <TableCell colSpan={7} sx={{ border: 0 }}>
                    <EmptyState
                      icon={<TrendingDownRoundedIcon />}
                      title="Nenhuma conta a pagar"
                      description="Registre pagamentos e despesas para acompanhar o caixa."
                      actionLabel="Nova Conta"
                      onAction={() => setDialogNova(true)}
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

      <TablePagination
        component="div" count={total} page={page}
        onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[5, 10, 20]} labelRowsPerPage="Linhas por página:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `mais de ${to}`}`}
        sx={{ bgcolor: "transparent", borderTop: (t) => `1px solid ${t.palette.divider}` }}
      />

      {/* Menu 3-pontos */}
      <Menu
        anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={() => openAcao("historico")}>
          <HistoryRoundedIcon fontSize="small" sx={{ mr: 1.5, color: "text.secondary" }} />Histórico de pagamentos
        </MenuItem>
        {can("financeiro", "delete") && (
          <MenuItem onClick={() => openAcao("estornar")} disabled={selected?.status !== "pago" && selected?.status !== "parcial"}>
            <UndoRoundedIcon fontSize="small" sx={{ mr: 1.5, color: "warning.main" }} />Estornar pagamento
          </MenuItem>
        )}
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
        <MenuItem
          onClick={handleCancelar}
          disabled={selected?.status === "pago" || selected?.status === "parcial"}
          sx={{ color: "error.main" }}
        >
          <BlockRoundedIcon fontSize="small" sx={{ mr: 1.5 }} />Cancelar título
        </MenuItem>
      </Menu>

      {/* Dialogs de ação */}
      <ReceberDialog
        open={acao === "pagar"}
        onClose={() => setAcao(null)}
        tipo="pagar"
        saldoRestante={selected ? valorRestante(selected) : 0}
        onConfirm={(d) =>
          handleAcao(
            () => marcarComoPago(selected!.id, d),
            (r) =>
              r?.titulo_saldo
                ? `Pagamento parcial registrado! O saldo de ${brl(Number(r.titulo_saldo.valor_original))} foi lançado como um novo título pendente.`
                : "Pagamento confirmado!"
          )
        }
      />
      <EstornarDialog
        open={acao === "estornar"}
        onClose={() => setAcao(null)}
        tipo="pagar"
        valorPago={selected ? Number(selected.valor_pago) : 0}
        onConfirm={(d) => handleAcao(() => estornarPagamento(selected!.id, d), "Pagamento estornado!")}
      />
      <MovimentosDialog
        open={acao === "historico"}
        onClose={() => setAcao(null)}
        contaId={selected?.id ?? null}
        tipo="pagar"
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

      {/* Dialog editar (básico) */}
      <EditarDialog
        open={acao === "editar"}
        conta={selected}
        onClose={() => setAcao(null)}
        onConfirm={(d) => handleAcao(() => atualizarPagamento(selected!.id, d), "Conta atualizada!")}
      />

      {/* Dialog nova conta */}
      <NovaContaPagarDialog
        open={dialogNova}
        onClose={() => setDialogNova(false)}
        fornecedores={fornecedores}
        onConfirm={async (payload) => {
          try {
            await criarPagamento({ ...payload, tipo: "pagar", oficina_id: user?.oficina_id });
            recarregarTudo();
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
    <AppDialog open={open} onClose={onClose} onCloseClick={onClose} closeOnBackdrop={false} maxWidth="xs" title="Editar conta" icon={<EditRoundedIcon />} variant="entity">
      <AppDialogContent>
        <Stack spacing={2}>
          <TextField label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} size="small" fullWidth />
          <TextField label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} size="small" fullWidth />
          <TextField label="Observação" value={observacao} onChange={(e) => setObservacao(e.target.value)} size="small" fullWidth multiline rows={2} />
        </Stack>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
        <Button variant="contained" disableElevation sx={{ textTransform: "none" }}
          onClick={() => onConfirm({ descricao, categoria, observacao })}>
          Salvar
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}

// ── Dialog nova conta a pagar ─────────────────────────────────────────────────

function NovaContaPagarDialog({ open, onClose, fornecedores, onConfirm }: {
  open: boolean; onClose: () => void; fornecedores: any[];
  onConfirm: (data: any) => void;
}) {
  const [form, setForm] = React.useState({ descricao: "", valor: "", data_vencimento: "", metodo: "pix", fornecedor_id: "", categoria: "", observacao: "" });
  const set = (field: string, v: string) => setForm((p) => ({ ...p, [field]: v }));

  React.useEffect(() => {
    if (open) setForm({ descricao: "", valor: "", data_vencimento: "", metodo: "pix", fornecedor_id: "", categoria: "", observacao: "" });
  }, [open]);

  const valido = form.descricao.trim() && parseFloat(form.valor) > 0 && form.data_vencimento;

  return (
    <AppDialog open={open} onClose={onClose} onCloseClick={onClose} closeOnBackdrop={false} maxWidth="sm" title="Nova conta a pagar" icon={<TrendingDownRoundedIcon />} variant="entity">
      <AppDialogContent>
        <Stack spacing={2}>
          <TextField select label="Fornecedor (opcional)" value={form.fornecedor_id} onChange={(e) => set("fornecedor_id", e.target.value)} size="small" fullWidth>
            <MenuItem value="">Sem fornecedor</MenuItem>
            {fornecedores.map((f) => <MenuItem key={f.id} value={f.id}>{f.nome}</MenuItem>)}
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
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
        <Button variant="contained" disableElevation disabled={!valido} sx={{ textTransform: "none" }}
          onClick={() => onConfirm({ ...form, valor: parseFloat(form.valor), fornecedor_id: form.fornecedor_id ? Number(form.fornecedor_id) : null, status: "pendente" })}>
          Salvar
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}
