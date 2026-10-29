import * as React from "react";
import {
  Box, Stack, Typography, Button, IconButton, Chip, Tooltip,
  Table, TableBody, TableCell, TableHead, TableRow, TablePagination,
  Menu, MenuItem, Divider, Fade, CircularProgress, TextField, InputAdornment,
} from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import SellRoundedIcon from "@mui/icons-material/SellRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../context/ToastContext";
import { useConfirm } from "../../../../context/ConfirmContext";
import { useListaPaginada } from "../../../../hooks/useListaPaginada";
import ModuleHeader from "../../../../components/layout/ModuleHeader";
import StatCard, { StatGroup } from "../../../../components/common/StatCard";
import CampoData from "../../../../components/common/CampoData";
import TextoLimitado from "../../../../components/common/TextoLimitado";
import EmptyState from "../../../../components/common/EmptyState";
import ListTableContainer from "../../../../components/common/ListTableContainer";
import { AppDrawer, DrawerSection } from "../../../../components/common/AppDrawer";
import api from "../../../../api/api";
import { type Conta, brl, isVencido, valorLiquido, formatarData, METODO_OPTIONS, criarPagamento, atualizarPagamento, marcarComoPago, estornarPagamento, parcelar, cancelarPagamento, resumoPagamentos, type ResumoContas } from "../../api/api";
import {
  EstornarDialog, DetalhesDialog,
} from "../../dialogs/index";
import FiltrosContas, { filtrosPadrao, paramsFiltros, temFiltroAtivo, type FiltrosConta } from "../../components/FiltrosContas";
import { ReceberTituloDialog, RenegociarTituloDialog } from "../../dialogs/TituloDialogs";
import { EditarContaDialog } from "../../dialogs/EditarContaDialog";

type Acao = "pagar" | "estornar" | "detalhes" | "renegociar" | "editar" | null;

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
  const [filtros, setFiltros] = React.useState<FiltrosConta>(() => filtrosPadrao());
  const filtrado = !!query || temFiltroAtivo(filtros);
  const limparFiltros = () => { setQuery(""); setFiltros(filtrosPadrao()); };

  const { rows: contas, total, carregandoInicial, page, setPage, rowsPerPage, setRowsPerPage, recarregar } =
    useListaPaginada<Conta>("/pagamentos", {
      filtros: {
        tipo: "pagar",
        search: query,
        ...paramsFiltros(filtros, "fornecedor_id"),
      },
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
  const pagoMes = resumoApi?.pago_mes ?? 0;
  const totalVencidos = resumoApi?.vencidos ?? 0;
  const aVencer = resumoApi?.a_vencer ?? 0;

  const resumo = [
    { label: "Total a pagar",  value: brl(totalAberto),   icon: <TrendingDownRoundedIcon />,     tone: "error" },
    { label: "Pago no mês",  value: brl(pagoMes),   icon: <CheckCircleRoundedIcon />,    tone: "success" },
    { label: "Vencidos",         value: brl(totalVencidos), icon: <ErrorOutlineRoundedIcon />,   tone: "error" },
    { label: "A vencer (mês)",   value: brl(aVencer),       icon: <ScheduleRoundedIcon />,       tone: "warning" },
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
      <StatGroup espalhar>
        {resumo.map((r) => (
          <StatCard key={r.label} label={r.label} value={r.value} icon={r.icon} tone={r.tone} />
        ))}
      </StatGroup>

      <FiltrosContas
        filtros={filtros}
        onChange={setFiltros}
        tipo="pagar"
        rotuloParceiro="Fornecedor"
        parceiros={fornecedores}
      />

      {/* Tabela */}
      <Fade in timeout={400}>
        <ListTableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Fornecedor</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell align="center">Vencimento</TableCell>
                <TableCell align="center">Valor</TableCell>
                <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>Valor pago</TableCell>
                <TableCell align="center">Situação</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contas.length > 0 ? contas.map((conta) => {
                const liquido = valorLiquido(conta);
                return (
                  <TableRow
                    key={conta.id} hover
                    sx={{ height: 56 }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {conta.fornecedor?.nome ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TextoLimitado texto={conta.descricao ?? "—"} linhas={2} variant="body2" color="text.secondary" />
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                        <Typography variant="body2">
                          {formatarData(conta.data_vencimento)}
                        </Typography>
                        {conta.vezes_renegociado > 0 && (
                          <Tooltip title={`Data original: ${formatarData(conta.data_vencimento_original)} · Renegociado ${conta.vezes_renegociado}×`}>
                            <EventRepeatRoundedIcon sx={{ fontSize: 13, color: "warning.main", cursor: "help" }} />
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center">
                        <Typography variant="body2" fontWeight={600}>
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
                        {Number(conta.multa) > 0 && (
                          <Tooltip title={`Multa de ${brl(Number(conta.multa))}`}>
                            <GavelRoundedIcon sx={{ fontSize: 13, color: "error.main" }} />
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      {Number(conta.valor_pago) > 0 ? (
                        <Typography variant="body2" fontWeight={600}>
                          {brl(Number(conta.valor_pago))}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.disabled">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center"><StatusChip conta={conta} /></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="text"
                          color="primary"
                          onClick={() => handlePagarDireto(conta)}
                          disabled={conta.status === "pago" || conta.status === "cancelado"}
                          sx={{
                            fontWeight: 700,
                            letterSpacing: 0.6,
                            px: 1.75,
                            // Já pago: continua visível, mas bem mais apagado.
                            "&.Mui-disabled": { color: "primary.main", opacity: 0.35 },
                          }}
                        >
                          PAGAR
                        </Button>
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
                      description="Registre contas a fornecedores para acompanhar as despesas."
                      actionLabel="Nova Conta"
                      onAction={() => setDialogNova(true)}
                      isFiltered={filtrado}
                      onClearFilter={limparFiltros}
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
        <MenuItem onClick={() => openAcao("detalhes")}>
          <VisibilityRoundedIcon fontSize="small" sx={{ mr: 1.5, color: "text.secondary" }} />Detalhes
        </MenuItem>
        <Divider />
        {selected?.status === "pago" && can("financeiro", "delete") && (
          <MenuItem onClick={() => openAcao("estornar")}>
            <UndoRoundedIcon fontSize="small" sx={{ mr: 1.5, color: "warning.main" }} />Estornar pagamento
          </MenuItem>
        )}
        <MenuItem onClick={() => openAcao("renegociar")} disabled={selected?.status !== "pendente"}>
          <EventRepeatRoundedIcon fontSize="small" sx={{ mr: 1.5, color: "secondary.main" }} />Renegociar
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
      <ReceberTituloDialog
        open={acao === "pagar"}
        onClose={() => setAcao(null)}
        conta={selected}
        tipo="pagar"
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
      <DetalhesDialog
        open={acao === "detalhes"}
        onClose={() => setAcao(null)}
        conta={selected}
        tipo="pagar"
      />
      <RenegociarTituloDialog
        open={acao === "renegociar"}
        onClose={() => setAcao(null)}
        conta={selected}
        tipo="pagar"
        onConfirm={(d) => handleAcao(() => parcelar(selected!.id, d), "Título renegociado e parcelado!")}
      />

      {/* Dialog editar */}
      <EditarContaDialog
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

  const linha = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 } as const;

  const footer = (
    <>
      <Box />
      <Stack direction="row" spacing={1.5}>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
        <Button variant="contained" disableElevation disabled={!valido} sx={{ fontWeight: 700 }}
          onClick={() => onConfirm({ ...form, valor: parseFloat(form.valor), fornecedor_id: form.fornecedor_id ? Number(form.fornecedor_id) : null, status: "pendente" })}>
          Salvar
        </Button>
      </Stack>
    </>
  );

  return (
    <AppDrawer open={open} onClose={onClose} title="Nova conta a pagar" subtitle="Cadastre um título a pagar a um fornecedor" icon={<TrendingDownRoundedIcon />} footer={footer}>
      <DrawerSection title="Dados da conta">
        <Stack spacing={2}>
          <TextField select label="Fornecedor (opcional)" value={form.fornecedor_id} onChange={(e) => set("fornecedor_id", e.target.value)} size="small" fullWidth>
            <MenuItem value="">Sem fornecedor</MenuItem>
            {fornecedores.map((f) => <MenuItem key={f.id} value={f.id}>{f.nome}</MenuItem>)}
          </TextField>
          <TextField label="Descrição *" value={form.descricao} onChange={(e) => set("descricao", e.target.value)} size="small" fullWidth autoFocus />
          <TextField label="Categoria" value={form.categoria} onChange={(e) => set("categoria", e.target.value)} size="small" fullWidth />
        </Stack>
      </DrawerSection>

      <DrawerSection title="Valor e vencimento">
        <Stack spacing={2}>
          <Box sx={linha}>
            <TextField label="Valor *" type="number" value={form.valor} onChange={(e) => set("valor", e.target.value)} size="small" fullWidth InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }} />
            <CampoData label="Vencimento *" value={form.data_vencimento} onChange={(v) => set("data_vencimento", v)} />
          </Box>
          <TextField select label="Método" value={form.metodo} onChange={(e) => set("metodo", e.target.value)} size="small" fullWidth>
            {METODO_OPTIONS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>
        </Stack>
      </DrawerSection>

      <DrawerSection title="Observações">
        <TextField placeholder="Anotações sobre a conta" inputProps={{ "aria-label": "Observação" }} value={form.observacao} onChange={(e) => set("observacao", e.target.value)} size="small" fullWidth multiline rows={3} />
      </DrawerSection>
    </AppDrawer>
  );
}
