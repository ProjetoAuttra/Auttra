import * as React from "react";
import {
  Box, Stack, Typography, Divider, Chip, Tabs, Tab,
  Button, TextField, MenuItem, InputAdornment,
} from "@mui/material";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import SellRoundedIcon from "@mui/icons-material/SellRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import { AppDialog, AppDialogActions, AppDialogContent } from "../../../components/common/AppDialog";
import { METODO_OPTIONS, METODO_LABEL, brl, formatarData, listarMovimentos, valorLiquido, valorRestante, type Conta, type Movimento } from "../api/api";

// ── 1. Receber / Pagar (valor editavel; menor que o saldo = parcial) ──────────

const toCents = (v: number) => Math.round(v * 100);

export function ReceberDialog({ open, onClose, onConfirm, saldoRestante, tipo }: {
  open: boolean;
  onClose: () => void;
  saldoRestante: number;
  tipo: "receber" | "pagar";
  onConfirm: (data: { metodo: string; valor?: number; data_pagamento?: string }) => void;
}) {
  const [valorStr, setValorStr] = React.useState("");
  const [metodo, setMetodo] = React.useState("pix");
  const [dataPagamento, setDataPagamento] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setValorStr(saldoRestante > 0 ? saldoRestante.toFixed(2) : "");
      setMetodo("pix");
      setDataPagamento("");
    }
  }, [open, saldoRestante]);

  const receber = tipo === "receber";
  const semSaldo = toCents(saldoRestante) <= 0; // ex.: desconto de 100%: so confirma a baixa
  const valor = parseFloat(valorStr) || 0;
  const excede = toCents(valor) > toCents(saldoRestante);
  const invalido = !semSaldo && (valor <= 0 || excede);
  const parcial = !semSaldo && !invalido && toCents(valor) < toCents(saldoRestante);

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      onCloseClick={onClose}
      closeOnBackdrop={false}
      maxWidth="xs"
      title={receber ? "Receber" : "Pagar"}
      icon={<CheckRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Saldo em aberto: <strong>{brl(saldoRestante)}</strong>
        </Typography>
        <Stack spacing={1.5}>
          {!semSaldo && (
            <TextField
              label={receber ? "Valor recebido *" : "Valor pago *"}
              type="number"
              value={valorStr}
              onChange={(e) => setValorStr(e.target.value)}
              size="small"
              fullWidth
              autoFocus
              error={valorStr !== "" && invalido}
              helperText={
                excede
                  ? `Máximo: ${brl(saldoRestante)}`
                  : parcial
                    ? `${receber ? "Recebimento" : "Pagamento"} parcial — restará ${brl(saldoRestante - valor)}`
                    : undefined
              }
              InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
              inputProps={{ min: 0, step: "0.01" }}
            />
          )}
          <TextField
            select
            label="Método *"
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            size="small"
            fullWidth
          >
            {METODO_OPTIONS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>
          {!parcial && (
            <TextField
              label={receber ? "Data do recebimento" : "Data do pagamento"}
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText="Deixe vazio para usar a data de hoje"
            />
          )}
        </Stack>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
        <Button
          variant="contained"
          disableElevation
          disabled={invalido}
          onClick={() =>
            onConfirm({
              metodo,
              valor: semSaldo ? undefined : valor,
              data_pagamento: parcial ? undefined : dataPagamento || undefined,
            })
          }
          sx={{ fontWeight: 700 }}
        >
          {parcial
            ? `Registrar ${receber ? "recebimento" : "pagamento"} parcial`
            : receber ? "Confirmar recebimento" : "Confirmar pagamento"}
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}

// ── 2. Estornar ───────────────────────────────────────────────────────────────

export function EstornarDialog({ open, onClose, onConfirm, valorPago, tipo }: {
  open: boolean;
  onClose: () => void;
  valorPago: number;
  tipo: "receber" | "pagar";
  onConfirm: (data: { motivo: string }) => void;
}) {
  const [motivo, setMotivo] = React.useState("");
  React.useEffect(() => { if (open) setMotivo(""); }, [open]);

  const motivoValido = motivo.trim().length >= 3;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      onCloseClick={onClose}
      closeOnBackdrop={false}
      maxWidth="xs"
      title="Estornar pagamento"
      icon={<UndoRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Serão estornados <strong>{brl(valorPago)}</strong> {tipo === "receber" ? "recebidos" : "pagos"}. O título volta para
          pendente e o histórico do {tipo === "receber" ? "recebimento" : "pagamento"} é mantido.
        </Typography>
        <TextField
          label="Motivo do estorno *"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          size="small"
          fullWidth
          multiline
          minRows={2}
          autoFocus
          inputProps={{ maxLength: 300 }}
        />
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
        <Button
          variant="contained"
          color="error"
          disableElevation
          disabled={!motivoValido}
          onClick={() => onConfirm({ motivo: motivo.trim() })}
          sx={{ fontWeight: 700 }}
        >
          Estornar
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}

// ── 2b. Histórico de movimentos ───────────────────────────────────────────────

/** Lista de movimentações do título (recebimentos/pagamentos e estornos), usada no histórico e nos detalhes. */
export function HistoricoMovimentos({ ativo, contaId, tipo }: {
  ativo: boolean;
  contaId: number | null;
  tipo: "receber" | "pagar";
}) {
  const [movs, setMovs] = React.useState<Movimento[] | null>(null);
  const [erro, setErro] = React.useState("");

  React.useEffect(() => {
    if (!ativo || !contaId) return;
    let vivo = true;
    setMovs(null);
    setErro("");
    listarMovimentos(contaId)
      .then((m) => { if (vivo) setMovs(m); })
      .catch((err) => { if (vivo) setErro(err?.response?.data?.message ?? "Não foi possível carregar o histórico."); });
    return () => { vivo = false; };
  }, [ativo, contaId]);

  const rotulo = (m: Movimento) =>
    m.tipo === "estorno" ? "Estorno" : tipo === "receber" ? "Recebimento" : "Pagamento";

  if (erro) return <Typography color="error" variant="body2">{erro}</Typography>;
  if (movs === null) return <Typography variant="body2" color="text.secondary">Carregando...</Typography>;
  if (movs.length === 0) return <Typography variant="body2" color="text.secondary">Nenhuma movimentação registrada neste título.</Typography>;

  return (
    <Stack spacing={1.25} divider={<Divider flexItem />}>
      {movs.map((m) => (
        <Stack key={m.id} spacing={0.25}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
            <Typography variant="body2" fontWeight={700} color={m.tipo === "estorno" ? "error.main" : "success.main"}>
              {rotulo(m)} · {m.tipo === "estorno" ? "−" : "+"}{brl(Number(m.valor))}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {new Date(m.created_at).toLocaleString("pt-BR")}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {[m.metodo ? METODO_LABEL[m.metodo] ?? m.metodo : null, m.usuario?.nome ? `por ${m.usuario.nome}` : null]
              .filter(Boolean)
              .join(" · ") || "—"}
          </Typography>
          {m.motivo && (
            <Typography variant="caption" color="text.secondary">Motivo: {m.motivo}</Typography>
          )}
        </Stack>
      ))}
    </Stack>
  );
}

export function MovimentosDialog({ open, onClose, contaId, tipo }: {
  open: boolean;
  onClose: () => void;
  contaId: number | null;
  tipo: "receber" | "pagar";
}) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      onCloseClick={onClose}
      maxWidth="sm"
      title="Histórico de movimentações"
      icon={<HistoryRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <HistoricoMovimentos ativo={open} contaId={contaId} tipo={tipo} />
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined">Fechar</Button>
      </AppDialogActions>
    </AppDialog>
  );
}

// ── 2c. Detalhes do título ────────────────────────────────────────────────────

const STATUS_LABEL: Record<Conta["status"], string> = {
  pendente: "Pendente",
  parcial: "Parcial",
  pago: "Quitado",
  cancelado: "Cancelado",
};

const STATUS_COR: Record<Conta["status"], "warning" | "success" | "default" | "info"> = {
  pendente: "warning",
  parcial: "info",
  pago: "success",
  cancelado: "default",
};

const dataBr = formatarData;

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
        {rotulo}
      </Typography>
      <Typography component="div" variant="body2" fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
        {children}
      </Typography>
    </Stack>
  );
}

/** Conteúdo de uma aba dos detalhes: título e campos direto sobre o fundo do modal, sem caixa extra. */
function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2 }}>
        {titulo}
      </Typography>
      {children}
    </Box>
  );
}

const GRADE = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2.5 } as const;
const LINHA_INTEIRA = { gridColumn: { sm: "1 / -1" } } as const;

type AbaDetalhes = "principais" | "valores" | "recebimento" | "historico";

export function DetalhesDialog({ open, onClose, conta, tipo }: {
  open: boolean;
  onClose: () => void;
  conta: Conta | null;
  tipo: "receber" | "pagar";
}) {
  const receber = tipo === "receber";
  const [aba, setAba] = React.useState<AbaDetalhes>("principais");
  const liquido = conta ? valorLiquido(conta) : 0;
  const restante = conta ? valorRestante(conta) : 0;
  const pessoa = receber ? conta?.cliente?.nome : conta?.fornecedor?.nome;

  // Cada abertura começa na primeira aba.
  React.useEffect(() => {
    if (open) setAba("principais");
  }, [open, conta?.id]);

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      onCloseClick={onClose}
      maxWidth="md"
      fullWidth
      title={receber ? "Detalhes do recebimento" : "Detalhes do pagamento"}
      icon={<VisibilityRoundedIcon />}
      confirmDiscard={false}
    >
      <AppDialogContent sx={{ pt: 0 }}>
        <Tabs
          value={aba}
          onChange={(_, v: AbaDetalhes) => setAba(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: (t) => `1px solid ${t.palette.divider}`, mb: 2.5, "& .MuiTab-root": { fontWeight: 700, letterSpacing: 0.4 } }}
        >
          <Tab value="principais" label="Dados principais" />
          <Tab value="valores" label="Valores" />
          <Tab value="recebimento" label={receber ? "Recebimento" : "Pagamento"} />
          <Tab value="historico" label="Histórico" />
        </Tabs>

        <Box sx={{ minHeight: 260 }}>
          {conta && aba === "principais" && (
            <Cartao titulo="Dados principais">
              <Box sx={GRADE}>
                <Campo rotulo="Data de vencimento">{dataBr(conta.data_vencimento)}</Campo>
                <Campo rotulo="Valor">{brl(liquido)}</Campo>
                <Campo rotulo="Situação">
                  <Chip
                    size="small"
                    label={STATUS_LABEL[conta.status] ?? conta.status}
                    color={STATUS_COR[conta.status] ?? "default"}
                    sx={{ fontWeight: 700 }}
                  />
                </Campo>
                <Box sx={LINHA_INTEIRA}>
                  <Campo rotulo={receber ? "Cliente" : "Fornecedor"}>{pessoa ?? "—"}</Campo>
                </Box>
                <Box sx={LINHA_INTEIRA}>
                  <Campo rotulo="Descrição">{conta.descricao || "—"}</Campo>
                </Box>
                <Campo rotulo="Categoria">{conta.categoria || "—"}</Campo>
                {conta.total_parcelas && conta.total_parcelas > 1 && (
                  <Campo rotulo="Parcela">{`${conta.parcela_numero ?? 1} de ${conta.total_parcelas}`}</Campo>
                )}
                {conta.ordem_servico && <Campo rotulo="Ordem de serviço">{`#${conta.ordem_servico.id}`}</Campo>}
                {conta.observacao && (
                  <Box sx={LINHA_INTEIRA}>
                    <Campo rotulo="Observação">{conta.observacao}</Campo>
                  </Box>
                )}
              </Box>
            </Cartao>
          )}

          {conta && aba === "valores" && (
            <Cartao titulo="Valores">
              <Box sx={GRADE}>
                <Campo rotulo="Valor original">{brl(Number(conta.valor_original))}</Campo>
                <Campo rotulo="Desconto">{Number(conta.desconto) > 0 ? brl(Number(conta.desconto)) : "—"}</Campo>
                <Campo rotulo={receber ? "Valor a receber" : "Valor a pagar"}>{brl(liquido)}</Campo>
                <Campo rotulo={receber ? "Recebido" : "Pago"}>{brl(Number(conta.valor_pago))}</Campo>
                {conta.status !== "pago" && conta.status !== "cancelado" && <Campo rotulo="Saldo restante">{brl(restante)}</Campo>}
                {Number(conta.desconto) > 0 && conta.motivo_desconto && (
                  <Box sx={LINHA_INTEIRA}>
                    <Campo rotulo="Motivo do desconto">{conta.motivo_desconto}</Campo>
                  </Box>
                )}
              </Box>
            </Cartao>
          )}

          {conta && aba === "recebimento" && (
            <Cartao titulo={receber ? "Recebimento" : "Pagamento"}>
              <Box sx={GRADE}>
                <Campo rotulo="Data de vencimento">{dataBr(conta.data_vencimento)}</Campo>
                <Campo rotulo={receber ? "Data de recebimento" : "Data de pagamento"}>{dataBr(conta.data_pagamento)}</Campo>
                {/* Em título ainda não recebido, o método é só o que foi combinado ao cadastrar (ou o do último recebimento estornado). */}
                <Campo rotulo={conta.status === "pendente" ? "Método previsto" : receber ? "Método de recebimento" : "Método de pagamento"}>
                  {conta.metodo ? METODO_LABEL[conta.metodo] ?? conta.metodo : "—"}
                </Campo>
                {conta.vezes_renegociado > 0 && (
                  <Box sx={LINHA_INTEIRA}>
                    <Campo rotulo="Renegociação">
                      {`Vencimento original em ${dataBr(conta.data_vencimento_original)} · renegociado ${conta.vezes_renegociado}×`}
                    </Campo>
                  </Box>
                )}
              </Box>
            </Cartao>
          )}

          {conta && aba === "historico" && (
            <Cartao titulo={receber ? "Histórico de recebimentos" : "Histórico de pagamentos"}>
              <HistoricoMovimentos ativo={open} contaId={conta.id} tipo={tipo} />
            </Cartao>
          )}
        </Box>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} sx={{ fontWeight: 700 }}>Fechar</Button>
      </AppDialogActions>
    </AppDialog>
  );
}

// ── 3. Desconto ───────────────────────────────────────────────────────────────

export function DescontoDialog({ open, onClose, onConfirm, valorOriginal }: {
  open: boolean;
  onClose: () => void;
  valorOriginal: number;
  onConfirm: (data: { desconto: number; motivo_desconto: string }) => void;
}) {
  const [valorStr, setValorStr] = React.useState("");
  const [motivo, setMotivo] = React.useState("");

  React.useEffect(() => { if (open) { setValorStr(""); setMotivo(""); } }, [open]);

  const valor = parseFloat(valorStr) || 0;
  const invalido = valor <= 0 || valor > valorOriginal || !motivo.trim();

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      onCloseClick={onClose}
      closeOnBackdrop={false}
      maxWidth="xs"
      title="Aplicar desconto"
      icon={<SellRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Valor original: <strong>{brl(valorOriginal)}</strong>
        </Typography>
        <Stack spacing={1.5}>
          <TextField
            label="Valor do desconto *"
            type="number"
            value={valorStr}
            onChange={(e) => setValorStr(e.target.value)}
            size="small"
            fullWidth
            error={valorStr !== "" && valor > valorOriginal}
            helperText={
              valorStr !== "" && valor > valorOriginal
                ? `Máximo: ${brl(valorOriginal)}`
                : valorStr && valor > 0
                  ? `Valor final: ${brl(valorOriginal - valor)}`
                  : undefined
            }
            InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
          />
          <TextField
            label="Motivo do desconto *"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            size="small"
            fullWidth
          />
        </Stack>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
        <Button
          variant="contained"
          disableElevation
          disabled={invalido}
          onClick={() => onConfirm({ desconto: valor, motivo_desconto: motivo.trim() })}
          sx={{ fontWeight: 700 }}
        >
          Aplicar desconto
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}

// ── 4. Renegociar prazo ───────────────────────────────────────────────────────

export function RenegociarDialog({ open, onClose, onConfirm }: {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { nova_data_vencimento: string }) => void;
}) {
  const [novaData, setNovaData] = React.useState("");

  React.useEffect(() => { if (open) setNovaData(""); }, [open]);

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      onCloseClick={onClose}
      closeOnBackdrop={false}
      maxWidth="xs"
      title="Renegociar prazo"
      icon={<EventRepeatRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          A data original será preservada para auditoria.
        </Typography>
        <TextField
          label="Nova data de vencimento *"
          type="date"
          value={novaData}
          onChange={(e) => setNovaData(e.target.value)}
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
        />
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
        <Button
          variant="contained"
          disableElevation
          disabled={!novaData}
          onClick={() => onConfirm({ nova_data_vencimento: novaData })}
          sx={{ fontWeight: 700 }}
        >
          Salvar nova data
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}

// ── 5. Parcelar ───────────────────────────────────────────────────────────────

export function ParcelarDialog({ open, onClose, onConfirm, valorOriginal }: {
  open: boolean;
  onClose: () => void;
  valorOriginal: number;
  onConfirm: (data: { total_parcelas: number; data_primeira_parcela: string; metodo?: string }) => void;
}) {
  const [totalStr, setTotalStr] = React.useState("2");
  const [dataPrimeira, setDataPrimeira] = React.useState("");
  const [metodo, setMetodo] = React.useState("");

  React.useEffect(() => { if (open) { setTotalStr("2"); setDataPrimeira(""); setMetodo(""); } }, [open]);

  const n = parseInt(totalStr) || 0;
  const valorParcela = n >= 2 ? valorOriginal / n : 0;
  const invalido = n < 2 || !dataPrimeira;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      onCloseClick={onClose}
      closeOnBackdrop={false}
      maxWidth="xs"
      title="Parcelar título"
      icon={<AccountTreeRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Valor original: <strong>{brl(valorOriginal)}</strong>
        </Typography>
        <Stack spacing={1.5}>
          <TextField
            label="Número de parcelas *"
            type="number"
            value={totalStr}
            onChange={(e) => setTotalStr(e.target.value)}
            size="small"
            fullWidth
            inputProps={{ min: 2, max: 60 }}
            helperText={valorParcela > 0 ? `${brl(valorParcela)} por parcela` : "Mínimo 2 parcelas"}
          />
          <TextField
            label="Data da 1ª parcela *"
            type="date"
            value={dataPrimeira}
            onChange={(e) => setDataPrimeira(e.target.value)}
            size="small"
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="As demais serão mensais automaticamente"
          />
          <TextField
            select
            label="Método (opcional)"
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            size="small"
            fullWidth
          >
            <MenuItem value=""><em>Não definido</em></MenuItem>
            {METODO_OPTIONS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>
        </Stack>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
        <Button
          variant="contained"
          disableElevation
          disabled={invalido}
          onClick={() => onConfirm({ total_parcelas: n, data_primeira_parcela: dataPrimeira, metodo: metodo || undefined })}
          sx={{ fontWeight: 700 }}
        >
          Confirmar parcelamento
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}
