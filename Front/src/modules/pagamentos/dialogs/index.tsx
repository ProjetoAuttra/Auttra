import * as React from "react";
import {
  Stack, Typography,
  Button, TextField, MenuItem, InputAdornment,
} from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import SellRoundedIcon from "@mui/icons-material/SellRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import { AppDialog, AppDialogActions, AppDialogContent } from "../../../components/common/AppDialog";
import { METODO_OPTIONS, brl } from "../api/api";

// ── 1. Marcar como pago ───────────────────────────────────────────────────────

export function PagarDialog({ open, onClose, onConfirm }: {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { metodo: string; data_pagamento?: string }) => void;
}) {
  const [metodo, setMetodo] = React.useState("pix");
  const [dataPagamento, setDataPagamento] = React.useState("");

  React.useEffect(() => { if (open) { setMetodo("pix"); setDataPagamento(""); } }, [open]);

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      title="Marcar como pago"
      icon={<CheckRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <Stack spacing={1.5}>
          <TextField
            select
            label="Método de pagamento *"
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            size="small"
            fullWidth
          >
            {METODO_OPTIONS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>
          <TextField
            label="Data do pagamento"
            type="date"
            value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)}
            size="small"
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="Deixe vazio para usar a data de hoje"
          />
        </Stack>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 999 }}>Cancelar</Button>
        <Button
          variant="contained"
          disableElevation
          onClick={() => onConfirm({ metodo, data_pagamento: dataPagamento || undefined })}
          sx={{ borderRadius: 999, fontWeight: 700 }}
        >
          Confirmar pagamento
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}

// ── 2. Pagamento parcial ──────────────────────────────────────────────────────

export function PagamentoParcialDialog({ open, onClose, onConfirm, saldoRestante }: {
  open: boolean;
  onClose: () => void;
  saldoRestante: number;
  onConfirm: (data: { valor_entrada: number; metodo: string }) => void;
}) {
  const [valorStr, setValorStr] = React.useState("");
  const [metodo, setMetodo] = React.useState("pix");

  React.useEffect(() => { if (open) { setValorStr(""); setMetodo("pix"); } }, [open]);

  const valor = parseFloat(valorStr) || 0;
  const invalido = valor <= 0 || valor > saldoRestante;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      title="Pagamento parcial"
      icon={<PaymentsRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Saldo restante: <strong>{brl(saldoRestante)}</strong>
        </Typography>
        <Stack spacing={1.5}>
          <TextField
            label="Valor recebido agora *"
            type="number"
            value={valorStr}
            onChange={(e) => setValorStr(e.target.value)}
            size="small"
            fullWidth
            error={valorStr !== "" && invalido}
            helperText={
              valorStr !== "" && valor > saldoRestante
                ? `Máximo: ${brl(saldoRestante)}`
                : valorStr && valor > 0
                  ? `Restará: ${brl(saldoRestante - valor)}`
                  : undefined
            }
            InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
          />
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
        </Stack>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 999 }}>Cancelar</Button>
        <Button
          variant="contained"
          disableElevation
          disabled={invalido}
          onClick={() => onConfirm({ valor_entrada: valor, metodo })}
          sx={{ borderRadius: 999, fontWeight: 700 }}
        >
          Registrar entrada
        </Button>
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
            placeholder="Ex.: cliente fiel, acordo comercial..."
          />
        </Stack>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 999 }}>Cancelar</Button>
        <Button
          variant="contained"
          disableElevation
          disabled={invalido}
          onClick={() => onConfirm({ desconto: valor, motivo_desconto: motivo.trim() })}
          sx={{ borderRadius: 999, fontWeight: 700 }}
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
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 999 }}>Cancelar</Button>
        <Button
          variant="contained"
          disableElevation
          disabled={!novaData}
          onClick={() => onConfirm({ nova_data_vencimento: novaData })}
          sx={{ borderRadius: 999, fontWeight: 700 }}
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
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 999 }}>Cancelar</Button>
        <Button
          variant="contained"
          disableElevation
          disabled={invalido}
          onClick={() => onConfirm({ total_parcelas: n, data_primeira_parcela: dataPrimeira, metodo: metodo || undefined })}
          sx={{ borderRadius: 999, fontWeight: 700 }}
        >
          Confirmar parcelamento
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}
