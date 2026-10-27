import * as React from "react";
import { Box, Button, Divider, InputAdornment, MenuItem, Stack, TextField, Typography } from "@mui/material";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import { AppDialog, AppDialogActions, AppDialogContent } from "../../../components/common/AppDialog";
import { METODO_OPTIONS, brl, formatarData, type Conta } from "../api/api";

const toCents = (v: number) => Math.round(v * 100);

function LinhaResumo({ rotulo, valor, forte = false }: { rotulo: string; valor: React.ReactNode; forte?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2}>
      <Typography variant="body2" color="text.secondary">{rotulo}</Typography>
      <Typography variant="body2" fontWeight={forte ? 800 : 600} sx={{ fontSize: forte ? 15 : undefined }}>{valor}</Typography>
    </Stack>
  );
}

const Titulo = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4, letterSpacing: 1 }}>{children}</Typography>
);

/** Resumo do título ao lado do formulário; `desconto` simula o desconto digitado, sem alterar o título. */
function Resumo({ conta, receber, desconto, linhas }: { conta: Conta; receber: boolean; desconto: number; linhas?: React.ReactNode }) {
  const original = Number(conta.valor_original);
  const jaPago = Number(conta.valor_pago);
  const saldo = original - desconto - jaPago;
  const pessoa = receber ? conta.cliente?.nome : conta.fornecedor?.nome;

  return (
    <Stack spacing={2}>
      <Box>
        <Titulo>Título</Titulo>
        <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>{pessoa ?? "—"}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{conta.descricao ?? "—"}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Vencimento: {formatarData(conta.data_vencimento)}</Typography>
      </Box>
      <Divider />
      <Stack spacing={1}>
        <Titulo>Valores</Titulo>
        <LinhaResumo rotulo="Valor original" valor={brl(original)} />
        <LinhaResumo rotulo="Desconto" valor={desconto > 0 ? `− ${brl(desconto)}` : "-"} />
        <LinhaResumo rotulo={receber ? "Já recebido" : "Já pago"} valor={jaPago > 0 ? brl(jaPago) : "-"} />
        <Divider />
        <LinhaResumo rotulo={receber ? "Saldo a receber" : "Saldo a pagar"} valor={brl(Math.max(saldo, 0))} forte />
        {linhas}
      </Stack>
    </Stack>
  );
}

function Estrutura({ formulario, resumo }: { formulario: React.ReactNode; resumo: React.ReactNode }) {
  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={3} divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />}>
      <Box sx={{ flex: 1, minWidth: 0 }}>{formulario}</Box>
      <Box sx={{ width: { xs: "100%", md: 270 }, flexShrink: 0 }}>{resumo}</Box>
    </Stack>
  );
}

export type DadosReceber = {
  metodo: string;
  valor?: number;
  data_pagamento?: string;
  desconto?: number;
  motivo_desconto?: string;
};

function FormReceber({ conta, receber, onConfirm }: { conta: Conta; receber: boolean; onConfirm: (d: DadosReceber) => void }) {
  const original = Number(conta.valor_original);
  const jaPago = Number(conta.valor_pago);
  const descontoAtual = Number(conta.desconto);

  const [descontoStr, setDescontoStr] = React.useState(descontoAtual > 0 ? descontoAtual.toFixed(2) : "");
  const [motivo, setMotivo] = React.useState(conta.motivo_desconto ?? "");
  const [valorStr, setValorStr] = React.useState(() => {
    const inicial = original - descontoAtual - jaPago;
    return inicial > 0 ? inicial.toFixed(2) : "";
  });
  const [valorEditado, setValorEditado] = React.useState(false);
  const [metodo, setMetodo] = React.useState("pix");
  const [data, setData] = React.useState("");

  const desconto = parseFloat(descontoStr) || 0;
  const descontoInvalido = desconto < 0 || toCents(desconto) > toCents(original) || toCents(original - desconto) < toCents(jaPago);
  const precisaMotivo = desconto > 0 && !motivo.trim();
  const saldo = original - (descontoInvalido ? descontoAtual : desconto) - jaPago;
  const semSaldo = toCents(saldo) <= 0; // ex.: desconto de 100%: só confirma a baixa

  // Enquanto o usuário não digitou o valor, ele acompanha o saldo (que muda com o desconto).
  React.useEffect(() => {
    if (!valorEditado) setValorStr(saldo > 0 ? saldo.toFixed(2) : "");
  }, [saldo, valorEditado]);

  const valor = parseFloat(valorStr) || 0;
  const excede = toCents(valor) > toCents(saldo);
  const valorInvalido = !semSaldo && (valor <= 0 || excede);
  const parcial = !semSaldo && !valorInvalido && toCents(valor) < toCents(saldo);
  const invalido = descontoInvalido || precisaMotivo || valorInvalido;
  const mudouDesconto = toCents(desconto) !== toCents(descontoAtual);

  return (
    <Estrutura
      formulario={
        <Stack spacing={2.5}>
          <Stack spacing={2}>
            <Titulo>{receber ? "Recebimento" : "Pagamento"}</Titulo>
            {!semSaldo && (
              <TextField
                label={receber ? "Valor recebido *" : "Valor pago *"}
                type="number"
                value={valorStr}
                onChange={(e) => { setValorStr(e.target.value); setValorEditado(true); }}
                size="small"
                fullWidth
                autoFocus
                error={valorStr !== "" && valorInvalido}
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
          </Stack>

          <Divider />

          <Stack spacing={2}>
            <Titulo>Desconto (opcional)</Titulo>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Valor do desconto"
                type="number"
                value={descontoStr}
                onChange={(e) => setDescontoStr(e.target.value)}
                size="small"
                fullWidth
                error={descontoStr !== "" && descontoInvalido}
                helperText={
                  descontoInvalido
                    ? toCents(desconto) > toCents(original) ? `Máximo: ${brl(original)}` : "Deixaria o valor abaixo do que já foi recebido"
                    : " "
                }
                InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
                inputProps={{ min: 0, step: "0.01" }}
              />
              <TextField
                label={desconto > 0 ? "Motivo do desconto *" : "Motivo do desconto"}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                size="small"
                fullWidth
                error={precisaMotivo}
                helperText={precisaMotivo ? "Informe o motivo" : " "}
              />
            </Stack>
          </Stack>

          <Box>
            <Button
              variant="contained"
              disableElevation
              disabled={invalido}
              sx={{ fontWeight: 700 }}
              onClick={() =>
                onConfirm({
                  metodo,
                  valor: semSaldo ? undefined : valor,
                  data_pagamento: data || undefined,
                  // O desconto só viaja quando mudou; 0 remove o desconto anterior.
                  ...(mudouDesconto ? { desconto, motivo_desconto: motivo.trim() || undefined } : {}),
                })
              }
            >
              {parcial ? `Registrar ${receber ? "recebimento" : "pagamento"} parcial` : receber ? "Confirmar recebimento" : "Confirmar pagamento"}
            </Button>
          </Box>
        </Stack>
      }
      resumo={<Resumo conta={conta} receber={receber} desconto={descontoInvalido ? descontoAtual : desconto} />}
    />
  );
}

type ReceberProps = {
  open: boolean;
  onClose: () => void;
  conta: Conta | null;
  tipo: "receber" | "pagar";
  onConfirm: (d: DadosReceber) => void;
};

/** Receber/pagar com desconto opcional na mesma tela: tudo é aplicado de uma vez, na mesma transação. */
export function ReceberTituloDialog({ open, onClose, conta, tipo, onConfirm }: ReceberProps) {
  const receber = tipo === "receber";
  return (
    <AppDialog open={open} onClose={onClose} onCloseClick={onClose} closeOnBackdrop={false} maxWidth="md" fullWidth title={receber ? "Receber" : "Pagar"} icon={<PaymentsRoundedIcon />} confirmDiscard={false}>
      <AppDialogContent>
        {open && conta && <FormReceber key={conta.id} conta={conta} receber={receber} onConfirm={onConfirm} />}
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
      </AppDialogActions>
    </AppDialog>
  );
}

export type DadosParcelar = { total_parcelas: number; data_primeira_parcela: string; metodo?: string };

function FormRenegociar({ conta, receber, onConfirm }: { conta: Conta; receber: boolean; onConfirm: (d: DadosParcelar) => void }) {
  const saldo = Number(conta.valor_original) - Number(conta.desconto) - Number(conta.valor_pago);
  const [totalStr, setTotalStr] = React.useState("2");
  const [dataPrimeira, setDataPrimeira] = React.useState("");
  const [metodo, setMetodo] = React.useState("");
  const n = parseInt(totalStr) || 0;
  const invalido = n < 2 || n > 60 || !dataPrimeira;

  return (
    <Estrutura
      formulario={
        <Stack spacing={2.5}>
          <Typography variant="body2" color="text.secondary">
            Divida o saldo deste {receber ? "recebimento" : "pagamento"} em parcelas mensais. Cada parcela vira um título independente e este título é substituído por elas.
          </Typography>
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
              error={totalStr !== "" && (n < 2 || n > 60)}
              helperText={n >= 2 && n <= 60 ? `${brl(saldo / n)} por parcela` : "Entre 2 e 60 parcelas"}
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
            <Button
              variant="contained"
              disableElevation
              disabled={invalido}
              sx={{ fontWeight: 700 }}
              onClick={() => onConfirm({ total_parcelas: n, data_primeira_parcela: dataPrimeira, metodo: metodo || undefined })}
            >
              Confirmar renegociação
            </Button>
          </Box>
        </Stack>
      }
      resumo={
        <Resumo
          conta={conta}
          receber={receber}
          desconto={Number(conta.desconto)}
          linhas={n >= 2 && n <= 60 ? <LinhaResumo rotulo="Parcelamento" valor={`${n} × ${brl(saldo / n)}`} /> : null}
        />
      }
    />
  );
}

type RenegociarProps = {
  open: boolean;
  onClose: () => void;
  conta: Conta | null;
  tipo: "receber" | "pagar";
  onConfirm: (d: DadosParcelar) => void;
};

/** Renegociar: parcela o saldo do título em várias vezes. */
export function RenegociarTituloDialog({ open, onClose, conta, tipo, onConfirm }: RenegociarProps) {
  const receber = tipo === "receber";
  return (
    <AppDialog open={open} onClose={onClose} onCloseClick={onClose} closeOnBackdrop={false} maxWidth="md" fullWidth title="Renegociar" icon={<EventRepeatRoundedIcon />} confirmDiscard={false}>
      <AppDialogContent>
        {open && conta && <FormRenegociar key={conta.id} conta={conta} receber={receber} onConfirm={onConfirm} />}
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
      </AppDialogActions>
    </AppDialog>
  );
}
