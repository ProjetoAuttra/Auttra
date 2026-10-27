import * as React from "react";
import { Box, Button, Divider, InputAdornment, MenuItem, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import { AppDialog, AppDialogActions, AppDialogContent } from "../../../components/common/AppDialog";
import { METODO_OPTIONS, brl, formatarData, valorLiquido, valorRestante, type Conta } from "../api/api";

const toCents = (v: number) => Math.round(v * 100);

export type AbaTitulo = "receber" | "desconto" | "renegociar" | "parcelar";

type Props = {
  open: boolean;
  onClose: () => void;
  conta: Conta | null;
  tipo: "receber" | "pagar";
  abaInicial?: AbaTitulo;
  onReceber: (d: { metodo: string; valor?: number; data_pagamento?: string }) => void;
  onDesconto: (d: { desconto: number; motivo_desconto: string }) => void;
  onRenegociar: (d: { nova_data_vencimento: string }) => void;
  onParcelar: (d: { total_parcelas: number; data_primeira_parcela: string; metodo?: string }) => void;
};

function LinhaResumo({ rotulo, valor, forte = false }: { rotulo: string; valor: React.ReactNode; forte?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2}>
      <Typography variant="body2" color="text.secondary">{rotulo}</Typography>
      <Typography variant="body2" fontWeight={forte ? 800 : 600} sx={{ fontSize: forte ? 15 : undefined }}>{valor}</Typography>
    </Stack>
  );
}

/** Painel de resumo do título, sempre visível ao lado do formulário. */
function Resumo({ conta, receber }: { conta: Conta; receber: boolean }) {
  const liquido = valorLiquido(conta);
  const restante = valorRestante(conta);
  const pessoa = receber ? conta.cliente?.nome : conta.fornecedor?.nome;

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4, letterSpacing: 1 }}>Título</Typography>
        <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>{pessoa ?? "—"}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{conta.descricao ?? "—"}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Vencimento: {formatarData(conta.data_vencimento)}</Typography>
      </Box>
      <Divider />
      <Stack spacing={1}>
        <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4, letterSpacing: 1 }}>Valores</Typography>
        <LinhaResumo rotulo="Valor original" valor={brl(Number(conta.valor_original))} />
        <LinhaResumo rotulo="Desconto" valor={Number(conta.desconto) > 0 ? `− ${brl(Number(conta.desconto))}` : "-"} />
        <LinhaResumo rotulo={receber ? "Já recebido" : "Já pago"} valor={Number(conta.valor_pago) > 0 ? brl(Number(conta.valor_pago)) : "-"} />
        <Divider />
        <LinhaResumo rotulo={receber ? "Saldo a receber" : "Saldo a pagar"} valor={brl(restante > 0 ? restante : liquido)} forte />
      </Stack>
    </Stack>
  );
}

function FormReceber({ conta, receber, onConfirm }: { conta: Conta; receber: boolean; onConfirm: Props["onReceber"] }) {
  const saldo = valorRestante(conta);
  const [valorStr, setValorStr] = React.useState(saldo > 0 ? saldo.toFixed(2) : "");
  const [metodo, setMetodo] = React.useState("pix");
  const [data, setData] = React.useState("");

  const semSaldo = toCents(saldo) <= 0;
  const valor = parseFloat(valorStr) || 0;
  const excede = toCents(valor) > toCents(saldo);
  const invalido = !semSaldo && (valor <= 0 || excede);
  const parcial = !semSaldo && !invalido && toCents(valor) < toCents(saldo);

  return (
    <Stack spacing={2}>
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
              ? `Máximo: ${brl(saldo)}`
              : parcial
                ? `O saldo de ${brl(saldo - valor)} será lançado como um novo título pendente`
                : " "
          }
          InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
          inputProps={{ min: 0, step: "0.01" }}
        />
      )}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField select label="Método *" value={metodo} onChange={(e) => setMetodo(e.target.value)} size="small" fullWidth>
          {METODO_OPTIONS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
        </TextField>
        <TextField
          label={receber ? "Data do recebimento" : "Data do pagamento"}
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
          helperText="Vazio = hoje"
        />
      </Stack>
      <Box>
        <Button
          variant="contained"
          disableElevation
          disabled={invalido}
          onClick={() => onConfirm({ metodo, valor: semSaldo ? undefined : valor, data_pagamento: data || undefined })}
          sx={{ fontWeight: 700 }}
        >
          {parcial ? `Registrar ${receber ? "recebimento" : "pagamento"} parcial` : receber ? "Confirmar recebimento" : "Confirmar pagamento"}
        </Button>
      </Box>
    </Stack>
  );
}

function FormDesconto({ conta, onConfirm }: { conta: Conta; onConfirm: Props["onDesconto"] }) {
  const original = Number(conta.valor_original);
  const [valorStr, setValorStr] = React.useState("");
  const [motivo, setMotivo] = React.useState("");
  const valor = parseFloat(valorStr) || 0;
  const excede = valor > original;
  const invalido = valor <= 0 || excede || !motivo.trim();

  return (
    <Stack spacing={2}>
      <TextField
        label="Valor do desconto *"
        type="number"
        value={valorStr}
        onChange={(e) => setValorStr(e.target.value)}
        size="small"
        fullWidth
        autoFocus
        error={valorStr !== "" && excede}
        helperText={excede ? `Máximo: ${brl(original)}` : valor > 0 ? `Valor final: ${brl(original - valor)}` : " "}
        InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
      />
      <TextField label="Motivo do desconto *" value={motivo} onChange={(e) => setMotivo(e.target.value)} size="small" fullWidth />
      <Box>
        <Button variant="contained" disableElevation disabled={invalido} onClick={() => onConfirm({ desconto: valor, motivo_desconto: motivo.trim() })} sx={{ fontWeight: 700 }}>
          Aplicar desconto
        </Button>
      </Box>
    </Stack>
  );
}

function FormRenegociar({ conta, onConfirm }: { conta: Conta; onConfirm: Props["onRenegociar"] }) {
  const [novaData, setNovaData] = React.useState("");
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Vencimento atual: <strong>{formatarData(conta.data_vencimento)}</strong>. A data original é preservada para auditoria.
      </Typography>
      <TextField
        label="Nova data de vencimento *"
        type="date"
        value={novaData}
        onChange={(e) => setNovaData(e.target.value)}
        size="small"
        fullWidth
        autoFocus
        InputLabelProps={{ shrink: true }}
      />
      <Box>
        <Button variant="contained" disableElevation disabled={!novaData} onClick={() => onConfirm({ nova_data_vencimento: novaData })} sx={{ fontWeight: 700 }}>
          Salvar nova data
        </Button>
      </Box>
    </Stack>
  );
}

function FormParcelar({ conta, onConfirm }: { conta: Conta; onConfirm: Props["onParcelar"] }) {
  const liquido = valorLiquido(conta);
  const [totalStr, setTotalStr] = React.useState("2");
  const [dataPrimeira, setDataPrimeira] = React.useState("");
  const [metodo, setMetodo] = React.useState("");
  const n = parseInt(totalStr) || 0;
  const invalido = n < 2 || n > 60 || !dataPrimeira;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          label="Número de parcelas *"
          type="number"
          value={totalStr}
          onChange={(e) => setTotalStr(e.target.value)}
          size="small"
          fullWidth
          autoFocus
          inputProps={{ min: 2, max: 60 }}
          helperText={n >= 2 ? `${brl(liquido / n)} por parcela` : "Mínimo 2 parcelas"}
        />
        <TextField
          label="Data da 1ª parcela *"
          type="date"
          value={dataPrimeira}
          onChange={(e) => setDataPrimeira(e.target.value)}
          size="small"
          fullWidth
          InputLabelProps={{ shrink: true }}
          helperText="As demais são mensais"
        />
      </Stack>
      <TextField select label="Método (opcional)" value={metodo} onChange={(e) => setMetodo(e.target.value)} size="small" fullWidth>
        <MenuItem value=""><em>Não definido</em></MenuItem>
        {METODO_OPTIONS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
      </TextField>
      <Box>
        <Button variant="contained" disableElevation disabled={invalido} onClick={() => onConfirm({ total_parcelas: n, data_primeira_parcela: dataPrimeira, metodo: metodo || undefined })} sx={{ fontWeight: 700 }}>
          Confirmar parcelamento
        </Button>
      </Box>
    </Stack>
  );
}

/**
 * Modal único do título: receber/pagar, dar desconto, renegociar prazo e parcelar. O resumo fica à direita
 * e cada aba tem o seu próprio botão de confirmar (as ações são independentes).
 */
export function GerenciarTituloDialog({ open, onClose, conta, tipo, abaInicial = "receber", onReceber, onDesconto, onRenegociar, onParcelar }: Props) {
  const receber = tipo === "receber";
  const [aba, setAba] = React.useState<AbaTitulo>(abaInicial);

  React.useEffect(() => {
    if (open) setAba(abaInicial);
  }, [open, abaInicial, conta?.id]);

  const parcelavel = conta?.status === "pendente";

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      onCloseClick={onClose}
      closeOnBackdrop={false}
      maxWidth="md"
      fullWidth
      title={receber ? "Receber" : "Pagar"}
      icon={<PaymentsRoundedIcon />}
      confirmDiscard={false}
    >
      <AppDialogContent sx={{ pt: 0 }}>
        {conta && (
          <Stack direction={{ xs: "column", md: "row" }} spacing={3} divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Tabs
                value={aba}
                onChange={(_, v: AbaTitulo) => setAba(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ borderBottom: (t) => `1px solid ${t.palette.divider}`, mb: 2.5, "& .MuiTab-root": { fontWeight: 700, letterSpacing: 0.4 } }}
              >
                <Tab value="receber" label={receber ? "Receber" : "Pagar"} />
                <Tab value="desconto" label="Desconto" />
                <Tab value="renegociar" label="Renegociar prazo" />
                <Tab value="parcelar" label="Parcelar" disabled={!parcelavel} />
              </Tabs>

              <Box sx={{ minHeight: 230 }}>
                {aba === "receber" && <FormReceber key={`r${conta.id}`} conta={conta} receber={receber} onConfirm={onReceber} />}
                {aba === "desconto" && <FormDesconto key={`d${conta.id}`} conta={conta} onConfirm={onDesconto} />}
                {aba === "renegociar" && <FormRenegociar key={`n${conta.id}`} conta={conta} onConfirm={onRenegociar} />}
                {aba === "parcelar" && <FormParcelar key={`p${conta.id}`} conta={conta} onConfirm={onParcelar} />}
              </Box>
            </Box>

            <Box sx={{ width: { xs: "100%", md: 270 }, flexShrink: 0, pt: { md: 1 } }}>
              <Resumo conta={conta} receber={receber} />
            </Box>
          </Stack>
        )}
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined">Fechar</Button>
      </AppDialogActions>
    </AppDialog>
  );
}
