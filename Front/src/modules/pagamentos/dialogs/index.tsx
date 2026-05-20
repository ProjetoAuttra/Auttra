import * as React from "react";
import {
  Dialog, DialogContent, DialogActions, Stack, Typography,
  Button, Paper, IconButton, TextField, MenuItem, InputAdornment,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import SellRoundedIcon from "@mui/icons-material/SellRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import { METODO_OPTIONS, brl } from "../api/api";

function AcaoHeader({ icon, title, subtitle, onClose }: {
  icon: React.ReactNode; title: string; subtitle: string; onClose: () => void;
}) {
  return (
    <Paper elevation={0} square sx={{
      px: 3, py: 2.5,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
      borderBottom: (t) => `1px solid ${alpha(t.palette.primary.main, 0.1)}`,
    }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Stack sx={{
          width: 36, height: 36, borderRadius: 2,
          bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
          alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </Stack>
        <Stack spacing={0.1}>
          <Typography variant="subtitle1" fontWeight={800} lineHeight={1.2}>{title}</Typography>
          <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
        </Stack>
      </Stack>
      <IconButton size="small" onClick={onClose}><CloseRoundedIcon fontSize="small" /></IconButton>
    </Paper>
  );
}

const paperProps = { sx: { borderRadius: 3, overflow: "hidden" } };
const actionsProps = { sx: { px: 3, py: 2, borderTop: (t: any) => `1px solid ${t.palette.divider}` } };
const btnSave = { disableElevation: true, sx: { textTransform: "none", fontWeight: 700, borderRadius: 999 } };
const btnCancel = { sx: { textTransform: "none", color: "text.secondary" } };

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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={paperProps}>
      <AcaoHeader
        icon={<CheckRoundedIcon fontSize="small" color="primary" />}
        title="Marcar como pago"
        subtitle="Confirme o método e a data"
        onClose={onClose}
      />
      <DialogContent sx={{ pt: 2.5, px: 3 }}>
        <Stack spacing={2}>
          <TextField
            select label="Método de pagamento *"
            value={metodo} onChange={(e) => setMetodo(e.target.value)}
            size="small" fullWidth
          >
            {METODO_OPTIONS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>
          <TextField
            label="Data do pagamento"
            type="date" value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)}
            size="small" fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="Deixe vazio para usar a data de hoje"
          />
        </Stack>
      </DialogContent>
      <DialogActions {...actionsProps}>
        <Button onClick={onClose} {...btnCancel}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => onConfirm({ metodo, data_pagamento: dataPagamento || undefined })}
          {...btnSave}
        >
          Confirmar pagamento
        </Button>
      </DialogActions>
    </Dialog>
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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={paperProps}>
      <AcaoHeader
        icon={<PaymentsRoundedIcon fontSize="small" color="primary" />}
        title="Pagamento parcial"
        subtitle={`Saldo restante: ${brl(saldoRestante)}`}
        onClose={onClose}
      />
      <DialogContent sx={{ pt: 2.5, px: 3 }}>
        <Stack spacing={2}>
          <TextField
            label="Valor recebido agora *"
            type="number" value={valorStr}
            onChange={(e) => setValorStr(e.target.value)}
            size="small" fullWidth
            error={valorStr !== "" && invalido}
            helperText={
              valorStr !== "" && valor > saldoRestante
                ? `Máximo: ${brl(saldoRestante)}`
                : valorStr && valor > 0
                  ? `Restará: ${brl(saldoRestante - valor)}`
                  : " "
            }
            InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
          />
          <TextField
            select label="Método *"
            value={metodo} onChange={(e) => setMetodo(e.target.value)}
            size="small" fullWidth
          >
            {METODO_OPTIONS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions {...actionsProps}>
        <Button onClick={onClose} {...btnCancel}>Cancelar</Button>
        <Button
          variant="contained" disabled={invalido}
          onClick={() => onConfirm({ valor_entrada: valor, metodo })}
          {...btnSave}
        >
          Registrar entrada
        </Button>
      </DialogActions>
    </Dialog>
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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={paperProps}>
      <AcaoHeader
        icon={<SellRoundedIcon fontSize="small" color="primary" />}
        title="Aplicar desconto"
        subtitle={`Valor original: ${brl(valorOriginal)}`}
        onClose={onClose}
      />
      <DialogContent sx={{ pt: 2.5, px: 3 }}>
        <Stack spacing={2}>
          <TextField
            label="Valor do desconto *"
            type="number" value={valorStr}
            onChange={(e) => setValorStr(e.target.value)}
            size="small" fullWidth
            error={valorStr !== "" && valor > valorOriginal}
            helperText={
              valorStr !== "" && valor > valorOriginal
                ? `Máximo: ${brl(valorOriginal)}`
                : valorStr && valor > 0
                  ? `Valor final: ${brl(valorOriginal - valor)}`
                  : " "
            }
            InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
          />
          <TextField
            label="Motivo do desconto *"
            value={motivo} onChange={(e) => setMotivo(e.target.value)}
            size="small" fullWidth
            placeholder="Ex.: cliente fiel, acordo comercial..."
            helperText=" "
          />
        </Stack>
      </DialogContent>
      <DialogActions {...actionsProps}>
        <Button onClick={onClose} {...btnCancel}>Cancelar</Button>
        <Button
          variant="contained" disabled={invalido}
          onClick={() => onConfirm({ desconto: valor, motivo_desconto: motivo.trim() })}
          {...btnSave}
        >
          Aplicar desconto
        </Button>
      </DialogActions>
    </Dialog>
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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={paperProps}>
      <AcaoHeader
        icon={<EventRepeatRoundedIcon fontSize="small" color="primary" />}
        title="Renegociar prazo"
        subtitle="A data original será preservada para auditoria"
        onClose={onClose}
      />
      <DialogContent sx={{ pt: 2.5, px: 3 }}>
        <TextField
          label="Nova data de vencimento *"
          type="date" value={novaData}
          onChange={(e) => setNovaData(e.target.value)}
          size="small" fullWidth
          InputLabelProps={{ shrink: true }}
          helperText=" "
        />
      </DialogContent>
      <DialogActions {...actionsProps}>
        <Button onClick={onClose} {...btnCancel}>Cancelar</Button>
        <Button
          variant="contained" disabled={!novaData}
          onClick={() => onConfirm({ nova_data_vencimento: novaData })}
          {...btnSave}
        >
          Salvar nova data
        </Button>
      </DialogActions>
    </Dialog>
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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={paperProps}>
      <AcaoHeader
        icon={<AccountTreeRoundedIcon fontSize="small" color="primary" />}
        title="Parcelar título"
        subtitle={`Valor original: ${brl(valorOriginal)}`}
        onClose={onClose}
      />
      <DialogContent sx={{ pt: 2.5, px: 3 }}>
        <Stack spacing={2}>
          <TextField
            label="Número de parcelas *"
            type="number" value={totalStr}
            onChange={(e) => setTotalStr(e.target.value)}
            size="small" fullWidth
            inputProps={{ min: 2, max: 60 }}
            helperText={valorParcela > 0 ? `${brl(valorParcela)} por parcela` : "Mínimo 2 parcelas"}
          />
          <TextField
            label="Data da 1ª parcela *"
            type="date" value={dataPrimeira}
            onChange={(e) => setDataPrimeira(e.target.value)}
            size="small" fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="As demais serão mensais automaticamente"
          />
          <TextField
            select label="Método (opcional)"
            value={metodo} onChange={(e) => setMetodo(e.target.value)}
            size="small" fullWidth
          >
            <MenuItem value=""><em>Não definido</em></MenuItem>
            {METODO_OPTIONS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions {...actionsProps}>
        <Button onClick={onClose} {...btnCancel}>Cancelar</Button>
        <Button
          variant="contained" disabled={invalido}
          onClick={() => onConfirm({ total_parcelas: n, data_primeira_parcela: dataPrimeira, metodo: metodo || undefined })}
          {...btnSave}
        >
          Confirmar parcelamento
        </Button>
      </DialogActions>
    </Dialog>
  );
}
