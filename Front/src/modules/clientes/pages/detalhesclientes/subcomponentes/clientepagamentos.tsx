import * as React from "react";
import {
  Table, TableHead, TableRow, TableCell, TableBody,
  Typography, Chip, Stack, Box, IconButton, Menu, MenuItem,
  Divider, Tooltip, Button, TextField, InputAdornment,
} from "@mui/material";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import SellRoundedIcon from "@mui/icons-material/SellRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import { useToast } from "../../../../../context/ToastContext";
import { useAuth } from "../../../../../context/AuthContext";
import { useConfirm } from "../../../../../context/ConfirmContext";
import ListTableContainer from "../../../../../components/common/ListTableContainer";
import StatCard, { StatGroup } from "../../../../../components/common/StatCard";
import TextoLimitado from "../../../../../components/common/TextoLimitado";
import CampoData from "../../../../../components/common/CampoData";
import { AppDialog, AppDialogActions, AppDialogContent } from "../../../../../components/common/AppDialog";
import {
  type Conta, brl, isVencido, valorLiquido, valorRestante, formatarData,
  METODO_OPTIONS,
  criarPagamento, atualizarPagamento,
  marcarComoPago, estornarPagamento, abrirRecibo, parcelar, cancelarPagamento,
} from "../../../../pagamentos/api/api";
import { EstornarDialog, DetalhesDialog } from "../../../../pagamentos/dialogs/index";
import { ReceberTituloDialog, RenegociarTituloDialog } from "../../../../pagamentos/dialogs/TituloDialogs";
import { EditarContaDialog } from "../../../../pagamentos/dialogs/EditarContaDialog";

type Acao = "pagar" | "estornar" | "detalhes" | "renegociar" | "editar" | null;

function StatusChip({ conta }: { conta: Conta }) {
  if (isVencido(conta))
    return <Chip label="Vencido" size="small" color="error" sx={{ fontWeight: 600, fontSize: 12 }} />;
  if (conta.status === "pago")
    return <Chip label="Recebido" size="small" color="success" sx={{ fontWeight: 600, fontSize: 12 }} />;
  if (conta.status === "cancelado")
    return <Chip label="Cancelado" size="small" sx={{ fontWeight: 600, fontSize: 12 }} />;
  return <Chip label="Pendente" size="small" color="warning" sx={{ fontWeight: 600, fontSize: 12 }} />;
}

export default function ClientePagamentos({
  pagamentos: pagamentosInit,
  clienteId,
  clienteNome,
  oficinaId,
}: {
  pagamentos: any[];
  clienteId: number;
  clienteNome?: string;
  oficinaId: number;
}) {
  const { can } = useAuth();
  const { success, error, warning } = useToast();
  const confirm = useConfirm();

  const [contas, setContas] = React.useState<Conta[]>([]);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selected, setSelected] = React.useState<Conta | null>(null);
  const [acao, setAcao] = React.useState<Acao>(null);
  const [dialogNova, setDialogNova] = React.useState(false);

  // A lista do cliente não traz o relacionamento com o cliente; os modais precisam dele para o resumo.
  React.useEffect(() => {
    setContas(((pagamentosInit ?? []) as Conta[]).map((c) => ({ ...c, cliente: c.cliente ?? { id: clienteId, nome: clienteNome ?? "—" } })));
  }, [pagamentosInit, clienteId, clienteNome]);

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, conta: Conta) => {
    setAnchorEl(e.currentTarget); setSelected(conta);
  };
  const handleMenuClose = () => { setAnchorEl(null); };
  const handleRecibo = async () => {
    const id = selected?.id;
    handleMenuClose();
    if (!id) return;
    try {
      await abrirRecibo(id);
    } catch {
      error("Não foi possível gerar o recibo.");
    }
  };
  const openAcao = (a: Acao) => { setAcao(a); handleMenuClose(); };
  const handleReceberDireto = (conta: Conta) => { setSelected(conta); setAcao("pagar"); };

  const comCliente = (c: Conta): Conta => ({ ...c, cliente: c.cliente ?? { id: clienteId, nome: clienteNome ?? "—" } });

  const handleAcao = async (fn: () => Promise<any>, msg: string | ((result: any) => string)) => {
    try {
      const result = await fn();
      if (result?.parcelas) {
        setContas((prev) => [
          ...result.parcelas.map(comCliente),
          ...prev.filter((c) => c.id !== selected?.id),
        ]);
      } else if (result?.id) {
        setContas((prev) => {
          const atualizadas = prev.map((c) => (c.id === result.id ? comCliente(result) : c));
          // Recebimento parcial: o saldo nasce como um novo título, logo depois do que foi recebido.
          if (result.titulo_saldo) {
            const i = atualizadas.findIndex((c) => c.id === result.id);
            atualizadas.splice(i + 1, 0, comCliente(result.titulo_saldo));
          }
          return atualizadas;
        });
      }
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
      setContas((prev) => prev.filter((c) => c.id !== selected.id));
      success("Título cancelado.");
    } catch (err: any) {
      error(err?.response?.data?.message ?? "Não foi possível cancelar o título.");
    }
  };

  const handleCriarPagamento = async (payload: any) => {
    if (!clienteId || !oficinaId) {
      error("Não foi possível identificar cliente ou oficina.");
      return;
    }
    try {
      const nova = await criarPagamento({
        ...payload,
        tipo: "receber",
        cliente_id: clienteId,
        oficina_id: oficinaId,
        status: "pendente",
      });
      setContas((prev) => [comCliente(nova), ...prev]);
      setDialogNova(false);
      success("Pagamento cadastrado!");
    } catch (err: any) {
      error(err?.response?.data?.message ?? "Não foi possível cadastrar o pagamento.");
    }
  };

  if (!contas.length) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
        <Typography color="text.disabled">Nenhum título financeiro registrado</Typography>
        <Button
          onClick={() => setDialogNova(true)}
          startIcon={<AddRoundedIcon />}
          variant="contained"
          disableElevation
          sx={{ mt: 2, fontWeight: 700 }}
        >
          Novo pagamento
        </Button>
        <NovoPagamentoClienteDialog
          open={dialogNova}
          onClose={() => setDialogNova(false)}
          onConfirm={handleCriarPagamento}
        />
      </Box>
    );
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const totalGeral = contas
    .filter((c) => c.status !== "cancelado")
    .reduce((s, c) => s + valorLiquido(c), 0);

  const totalPago = contas
    .filter((c) => c.status === "pago")
    .reduce((s, c) => s + valorLiquido(c), 0);

  const totalPendente = contas
    .filter((c) => c.status === "pendente" || c.status === "parcial")
    .reduce((s, c) => s + valorRestante(c), 0);

  const totalVencidos = contas
    .filter(isVencido)
    .reduce((s, c) => s + valorRestante(c), 0);

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" justifyContent="flex-end">
        <Button
          onClick={() => setDialogNova(true)}
          startIcon={<AddRoundedIcon />}
          variant="contained"
          disableElevation
          sx={{ fontWeight: 700 }}
        >
          Novo pagamento
        </Button>
      </Stack>

      <StatGroup espalhar sx={{ mb: 0 }}>
        <StatCard label="Total a receber" value={brl(totalGeral)} tone="primary" icon={<AccountBalanceWalletOutlinedIcon />} />
        <StatCard label="Recebido" value={brl(totalPago)} tone="success" icon={<CheckCircleOutlineRoundedIcon />} />
        <StatCard label="Pendente" value={brl(totalPendente)} tone="warning" icon={<ScheduleRoundedIcon />} />
        <StatCard label="Vencido" value={brl(totalVencidos)} tone="error" icon={<ErrorOutlineRoundedIcon />} />
      </StatGroup>

      <ListTableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Descrição</TableCell>
              <TableCell align="center">Vencimento</TableCell>
              <TableCell align="center">Valor</TableCell>
              <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>Valor recebido</TableCell>
              <TableCell align="center">Situação</TableCell>
              <TableCell align="right" aria-label="Ações" />
            </TableRow>
          </TableHead>
          <TableBody>
            {contas.map((conta) => {
              const liquido = valorLiquido(conta);
              return (
                <TableRow key={conta.id} hover>
                  <TableCell>
                    <TextoLimitado texto={conta.descricao || "—"} linhas={2} variant="body2" />
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                      <Typography variant="body2">{formatarData(conta.data_vencimento)}</Typography>
                      {conta.vezes_renegociado > 0 && (
                        <Tooltip title={`Data original: ${formatarData(conta.data_vencimento_original)} · Renegociado ${conta.vezes_renegociado}×`}>
                          <EventRepeatRoundedIcon sx={{ fontSize: 13, color: "warning.main", cursor: "help" }} />
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center">
                      <Typography variant="body2" fontWeight={600}>{brl(liquido)}</Typography>
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
                      <Typography variant="body2" fontWeight={600}>{brl(Number(conta.valor_pago))}</Typography>
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
                        onClick={() => handleReceberDireto(conta)}
                        disabled={conta.status === "pago" || conta.status === "cancelado"}
                        sx={{
                          fontWeight: 700,
                          letterSpacing: 0.6,
                          px: 1.75,
                          // Já recebido: continua visível, mas bem mais apagado.
                          "&.Mui-disabled": { color: "primary.main", opacity: 0.35 },
                        }}
                      >
                        RECEBER
                      </Button>
                      <IconButton size="small" aria-label="Mais ações" onClick={(e) => handleMenuOpen(e, conta)}>
                        <MoreVertRoundedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ListTableContainer>

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
        {selected?.status === "pago" && (
          <MenuItem onClick={handleRecibo}>
            <ReceiptLongRoundedIcon fontSize="small" sx={{ mr: 1.5, color: "text.secondary" }} />Gerar recibo
          </MenuItem>
        )}
        {selected?.status === "pago" && can("financeiro", "delete") && (
          <MenuItem onClick={() => openAcao("estornar")}>
            <UndoRoundedIcon fontSize="small" sx={{ mr: 1.5, color: "warning.main" }} />Estornar recebimento
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

      {/* Modais de ação */}
      <ReceberTituloDialog
        open={acao === "pagar"}
        onClose={() => setAcao(null)}
        conta={selected}
        tipo="receber"
        onConfirm={(d) =>
          handleAcao(
            async () => {
              const r = await marcarComoPago(selected!.id, d);
              if (r.emitir_recibo) {
                abrirRecibo(r.id)
                  .then((aberto) => { if (!aberto) warning("O navegador bloqueou a aba do recibo. Use “Gerar recibo” no menu da linha."); })
                  .catch(() => warning("Recebimento registrado, mas não foi possível abrir o recibo."));
              }
              return r;
            },
            (r) =>
              r?.titulo_saldo
                ? `Recebimento parcial registrado! O saldo de ${brl(Number(r.titulo_saldo.valor_original))} foi lançado como um novo título pendente.`
                : "Recebimento confirmado!"
          )
        }
      />
      <EstornarDialog
        open={acao === "estornar"}
        onClose={() => setAcao(null)}
        tipo="receber"
        valorPago={selected ? Number(selected.valor_pago) : 0}
        onConfirm={(d) => handleAcao(() => estornarPagamento(selected!.id, d), "Pagamento estornado!")}
      />
      <DetalhesDialog
        open={acao === "detalhes"}
        onClose={() => setAcao(null)}
        conta={selected}
        tipo="receber"
      />
      <RenegociarTituloDialog
        open={acao === "renegociar"}
        onClose={() => setAcao(null)}
        conta={selected}
        tipo="receber"
        onConfirm={(d) => handleAcao(() => parcelar(selected!.id, d), "Título renegociado e parcelado!")}
      />
      <EditarContaDialog
        open={acao === "editar"}
        conta={selected}
        onClose={() => setAcao(null)}
        onConfirm={(d) => handleAcao(() => atualizarPagamento(selected!.id, d), "Conta atualizada!")}
      />
      <NovoPagamentoClienteDialog
        open={dialogNova}
        onClose={() => setDialogNova(false)}
        onConfirm={handleCriarPagamento}
      />
    </Stack>
  );
}

function NovoPagamentoClienteDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: any) => void;
}) {
  const [form, setForm] = React.useState({
    descricao: "",
    valor: "",
    data_vencimento: "",
    metodo: "pix",
    categoria: "",
    observacao: "",
  });

  React.useEffect(() => {
    if (open) {
      setForm({ descricao: "", valor: "", data_vencimento: "", metodo: "pix", categoria: "", observacao: "" });
    }
  }, [open]);

  const set = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));
  const valido = form.descricao.trim() && Number(form.valor) > 0 && form.data_vencimento;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      onCloseClick={onClose}
      closeOnBackdrop={false}
      maxWidth="sm"
      title="Novo pagamento"
      icon={<TrendingUpRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <Stack spacing={2}>
          <TextField label="Descrição *" value={form.descricao} onChange={(e) => set("descricao", e.target.value)} size="small" fullWidth />
          <TextField label="Categoria" value={form.categoria} onChange={(e) => set("categoria", e.target.value)} size="small" fullWidth />
          <TextField
            label="Valor *"
            type="number"
            value={form.valor}
            onChange={(e) => set("valor", e.target.value)}
            size="small"
            fullWidth
            InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
          />
          <CampoData label="Vencimento *" value={form.data_vencimento} onChange={(v) => set("data_vencimento", v)} />
          <TextField select label="Método" value={form.metodo} onChange={(e) => set("metodo", e.target.value)} size="small" fullWidth>
            {METODO_OPTIONS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>
          <TextField label="Observação" value={form.observacao} onChange={(e) => set("observacao", e.target.value)} size="small" fullWidth multiline rows={2} />
        </Stack>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
        <Button
          variant="contained"
          disableElevation
          disabled={!valido}
          sx={{ fontWeight: 700 }}
          onClick={() => onConfirm({
            ...form,
            valor: Number(form.valor),
            data_pagamento: null,
          })}
        >
          Salvar
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}
