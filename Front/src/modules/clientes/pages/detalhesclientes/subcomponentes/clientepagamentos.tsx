import * as React from "react";
import {
  Table, TableHead, TableRow, TableCell, TableBody,
  Typography, Paper, Chip, Stack, Box, IconButton, Menu, MenuItem,
  Divider, Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import SellRoundedIcon from "@mui/icons-material/SellRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import { useToast } from "../../../../../context/ToastContext";
import { useConfirm } from "../../../../../context/ConfirmContext";
import ListTableContainer from "../../../../../components/common/ListTableContainer";
import {
  type Conta, brl, isVencido, valorLiquido, valorRestante,
  METODO_LABEL,
  marcarComoPago, registrarParcial, aplicarDesconto, renegociarPrazo,
  parcelar, cancelarPagamento,
} from "../../../../pagamentos/api/api";
import {
  PagarDialog, PagamentoParcialDialog, DescontoDialog, RenegociarDialog, ParcelarDialog,
} from "../../../../pagamentos/dialogs/index";

type Acao = "pagar" | "parcial" | "desconto" | "renegociar" | "parcelar" | null;

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

export default function ClientePagamentos({ pagamentos: pagamentosInit }: { pagamentos: any[] }) {
  const { success, error } = useToast();
  const confirm = useConfirm();

  const [contas, setContas] = React.useState<Conta[]>([]);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selected, setSelected] = React.useState<Conta | null>(null);
  const [acao, setAcao] = React.useState<Acao>(null);

  React.useEffect(() => {
    setContas((pagamentosInit ?? []) as Conta[]);
  }, [pagamentosInit]);

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, conta: Conta) => {
    setAnchorEl(e.currentTarget); setSelected(conta);
  };
  const handleMenuClose = () => { setAnchorEl(null); };
  const openAcao = (a: Acao) => { setAcao(a); handleMenuClose(); };

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

  if (!contas.length) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
        <Typography color="text.disabled">Nenhum título financeiro registrado</Typography>
      </Box>
    );
  }

  // ── Cards de resumo ────────────────────────────────────────────────────────
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

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
      {/* Resumo */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        {[
          { label: "Total a receber", value: brl(totalGeral),    color: "primary.main",  icon: <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 16 }} /> },
          { label: "Pago",            value: brl(totalPago),     color: "success.main",  icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: 16 }} /> },
          { label: "Pendente",        value: brl(totalPendente), color: "warning.main",  icon: <ScheduleRoundedIcon sx={{ fontSize: 16 }} /> },
          { label: "Vencido",         value: brl(totalVencidos), color: "error.main",    icon: <ErrorOutlineRoundedIcon sx={{ fontSize: 16 }} /> },
        ].map((c) => (
          <Paper key={c.label} elevation={0} sx={{
            flex: 1, p: 2, borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}`,
          }}>
            <Stack direction="row" alignItems="center" spacing={0.75} mb={0.25}>
              <Box sx={{ color: c.color, display: "flex" }}>{c.icon}</Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>{c.label}</Typography>
            </Stack>
            <Typography variant="h6" fontWeight={800} color={c.color}>{c.value}</Typography>
          </Paper>
        ))}
      </Stack>

      <ListTableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Descrição</TableCell>
              <TableCell>Valor</TableCell>
              <TableCell>Vencimento</TableCell>
              <TableCell>Método</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contas.map((conta) => {
              const vencido = isVencido(conta);
              const liquido = valorLiquido(conta);
              const restante = valorRestante(conta);
              return (
                <TableRow
                  key={conta.id} hover
                  sx={{ bgcolor: vencido ? (t) => alpha(t.palette.error.main, 0.04) : undefined }}
                >
                  <TableCell>
                    <Typography variant="body2">{conta.descricao || "—"}</Typography>
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
                      <Typography
                        variant="body2"
                        color={vencido ? "error.main" : "text.primary"}
                        fontWeight={vencido ? 700 : 400}
                      >
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
                    <IconButton size="small" onClick={(e) => handleMenuOpen(e, conta)}>
                      <MoreVertRoundedIcon fontSize="small" />
                    </IconButton>
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
        <MenuItem onClick={() => openAcao("pagar")} disabled={selected?.status === "pago" || selected?.status === "cancelado"}>
          <CheckCircleRoundedIcon fontSize="small" sx={{ mr: 1.5, color: "success.main" }} />Marcar como recebido
        </MenuItem>
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
    </Stack>
  );
}
