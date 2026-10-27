import * as React from "react";
import { Box, Button, Collapse, Divider, FormControlLabel, InputAdornment, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import { AppDialog, AppDialogActions, AppDialogContent } from "../../../components/common/AppDialog";
import CampoData from "../../../components/common/CampoData";
import TextoLimitado from "../../../components/common/TextoLimitado";
import { METODO_OPTIONS, brl, formatarData, hojeInput, type Conta } from "../api/api";

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
function Resumo({ conta, receber, desconto, multa, linhas }: { conta: Conta; receber: boolean; desconto: number; multa: number; linhas?: React.ReactNode }) {
  const original = Number(conta.valor_original);
  const jaPago = Number(conta.valor_pago);
  const saldo = original - desconto + multa - jaPago;
  const pessoa = receber ? conta.cliente?.nome : conta.fornecedor?.nome;

  return (
    <Stack spacing={2}>
      <Box>
        <Titulo>Título</Titulo>
        <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>{pessoa ?? "—"}</Typography>
        <TextoLimitado texto={conta.descricao ?? "—"} linhas={3} variant="body2" color="text.secondary" />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Vencimento: {formatarData(conta.data_vencimento)}</Typography>
      </Box>
      <Divider />
      <Stack spacing={1}>
        <Titulo>Valores</Titulo>
        <LinhaResumo rotulo="Valor original" valor={brl(original)} />
        <LinhaResumo rotulo="Desconto" valor={desconto > 0 ? `− ${brl(desconto)}` : "-"} />
        <LinhaResumo rotulo="Multa" valor={multa > 0 ? `+ ${brl(multa)}` : "-"} />
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
  multa?: number;
};

function FormReceber({ conta, receber, onConfirm, onCancel }: { conta: Conta; receber: boolean; onConfirm: (d: DadosReceber) => void; onCancel: () => void }) {
  const original = Number(conta.valor_original);
  const jaPago = Number(conta.valor_pago);
  const descontoAtual = Number(conta.desconto);
  const multaAtual = Number(conta.multa ?? 0);

  // O desconto só aparece quando ligado; um título que já tem desconto abre com ele ligado.
  const [comDesconto, setComDesconto] = React.useState(descontoAtual > 0);
  const [descontoStr, setDescontoStr] = React.useState(descontoAtual > 0 ? descontoAtual.toFixed(2) : "");
  const [motivo, setMotivo] = React.useState(conta.motivo_desconto ?? "");
  // A multa funciona como o desconto, só que soma ao valor e não pede motivo.
  const [comMulta, setComMulta] = React.useState(multaAtual > 0);
  const [multaStr, setMultaStr] = React.useState(multaAtual > 0 ? multaAtual.toFixed(2) : "");
  const [valorStr, setValorStr] = React.useState(() => {
    const inicial = original - descontoAtual + multaAtual - jaPago;
    return inicial > 0 ? inicial.toFixed(2) : "";
  });
  const [valorEditado, setValorEditado] = React.useState(false);
  const [metodo, setMetodo] = React.useState("");
  const [data, setData] = React.useState(hojeInput);

  const desconto = comDesconto ? parseFloat(descontoStr) || 0 : 0; // desligado = sem desconto (remove o atual)
  const multa = comMulta ? parseFloat(multaStr) || 0 : 0; // desligada = sem multa (remove a atual)
  const multaVazia = comMulta && multa <= 0; // ligou a multa mas não informou o valor
  const descontoInvalido = desconto < 0 || toCents(desconto) > toCents(original) || toCents(original - desconto + multa) < toCents(jaPago);
  const precisaMotivo = comDesconto && desconto > 0 && !motivo.trim();
  const descontoVazio = comDesconto && desconto <= 0; // ligou o desconto mas não informou o valor
  const saldo = original - (descontoInvalido ? descontoAtual : desconto) + multa - jaPago;
  const semSaldo = toCents(saldo) <= 0; // ex.: desconto de 100%: só confirma a baixa

  // Enquanto o usuário não digitou o valor, ele acompanha o saldo (que muda com o desconto).
  React.useEffect(() => {
    if (!valorEditado) setValorStr(saldo > 0 ? saldo.toFixed(2) : "");
  }, [saldo, valorEditado]);

  const valor = parseFloat(valorStr) || 0;
  const excede = toCents(valor) > toCents(saldo);
  const valorInvalido = !semSaldo && (valor <= 0 || excede);
  const parcial = !semSaldo && !valorInvalido && toCents(valor) < toCents(saldo);
  const invalido = descontoInvalido || precisaMotivo || descontoVazio || multaVazia || valorInvalido || !metodo || !data;
  const mudouDesconto = toCents(desconto) !== toCents(descontoAtual);
  const mudouMulta = toCents(multa) !== toCents(multaAtual);

  return (
    <>
    <AppDialogContent>
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
              <TextField select label="Método *" value={metodo} onChange={(e) => setMetodo(e.target.value)} size="small" fullWidth helperText=" ">
                {METODO_OPTIONS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
              </TextField>
              <CampoData
                label={receber ? "Data do recebimento *" : "Data do pagamento *"}
                value={data}
                onChange={setData}
                error={!data}
                helperText={!data ? "Informe a data" : " "}
              />
            </Stack>
          </Stack>

          <Divider />

          <Stack spacing={1}>
            <FormControlLabel
              sx={{ ml: 0 }}
              control={<Switch checked={comDesconto} onChange={(e) => setComDesconto(e.target.checked)} />}
              label={<Typography variant="body2" fontWeight={600}>Aplicar desconto</Typography>}
            />
            <Collapse in={comDesconto} unmountOnExit>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ pt: 1 }}>
                <TextField
                  label="Valor do desconto *"
                  type="number"
                  value={descontoStr}
                  onChange={(e) => setDescontoStr(e.target.value)}
                  size="small"
                  fullWidth
                  autoFocus
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
                  label="Motivo do desconto *"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  size="small"
                  fullWidth
                  error={precisaMotivo}
                  helperText={precisaMotivo ? "Informe o motivo" : " "}
                />
              </Stack>
            </Collapse>
          </Stack>

          <Stack spacing={1}>
            <FormControlLabel
              sx={{ ml: 0 }}
              control={<Switch checked={comMulta} onChange={(e) => setComMulta(e.target.checked)} />}
              label={<Typography variant="body2" fontWeight={600}>Aplicar multa</Typography>}
            />
            <Collapse in={comMulta} unmountOnExit>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ pt: 1 }}>
                <TextField
                  label="Valor da multa *"
                  type="number"
                  value={multaStr}
                  onChange={(e) => setMultaStr(e.target.value)}
                  size="small"
                  fullWidth
                  autoFocus
                  helperText=" "
                  InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
                  inputProps={{ min: 0, step: "0.01" }}
                />
              </Stack>
            </Collapse>
          </Stack>
        </Stack>
      }
      resumo={<Resumo conta={conta} receber={receber} desconto={descontoInvalido ? descontoAtual : desconto} multa={multa} />}
    />
    </AppDialogContent>
    <AppDialogActions>
      <Button onClick={onCancel} variant="outlined">Cancelar</Button>
        <Button
          variant="contained"
          disableElevation
          disabled={invalido}
          sx={{ fontWeight: 700 }}
          onClick={() =>
            onConfirm({
              metodo,
              valor: semSaldo ? undefined : valor,
              data_pagamento: data,
              // O desconto só viaja quando mudou; 0 remove o desconto anterior.
              ...(mudouDesconto ? { desconto, motivo_desconto: desconto > 0 ? motivo.trim() : undefined } : {}),
              // A multa também só viaja quando mudou; 0 remove a anterior.
              ...(mudouMulta ? { multa } : {}),
            })
          }
        >
          {parcial ? `Registrar ${receber ? "recebimento" : "pagamento"} parcial` : receber ? "Confirmar recebimento" : "Confirmar pagamento"}
        </Button>
    </AppDialogActions>
    </>
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
      {open && conta && <FormReceber key={conta.id} conta={conta} receber={receber} onConfirm={onConfirm} onCancel={onClose} />}
    </AppDialog>
  );
}

export type DadosParcelar = { total_parcelas: number; data_primeira_parcela: string; metodo?: string };

function FormRenegociar({ conta, receber, onConfirm, onCancel }: { conta: Conta; receber: boolean; onConfirm: (d: DadosParcelar) => void; onCancel: () => void }) {
  const saldo = Number(conta.valor_original) - Number(conta.desconto) + Number(conta.multa ?? 0) - Number(conta.valor_pago);
  const [totalStr, setTotalStr] = React.useState("2");
  const [dataPrimeira, setDataPrimeira] = React.useState("");
  const [metodo, setMetodo] = React.useState("");
  const n = parseInt(totalStr) || 0;
  const invalido = n < 2 || n > 60 || !dataPrimeira;

  return (
    <>
    <AppDialogContent>
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
            <CampoData label="Data da 1ª parcela *" value={dataPrimeira} onChange={setDataPrimeira} helperText="As demais são mensais" />
          </Stack>
          <TextField select label="Método (opcional)" value={metodo} onChange={(e) => setMetodo(e.target.value)} size="small" fullWidth>
            <MenuItem value=""><em>Não definido</em></MenuItem>
            {METODO_OPTIONS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>
        </Stack>
      }
      resumo={
        <Resumo
          conta={conta}
          receber={receber}
          desconto={Number(conta.desconto)}
          multa={Number(conta.multa ?? 0)}
          linhas={n >= 2 && n <= 60 ? <LinhaResumo rotulo="Parcelamento" valor={`${n} × ${brl(saldo / n)}`} /> : null}
        />
      }
    />
    </AppDialogContent>
    <AppDialogActions>
      <Button onClick={onCancel} variant="outlined">Cancelar</Button>
        <Button
          variant="contained"
          disableElevation
          disabled={invalido}
          sx={{ fontWeight: 700 }}
          onClick={() => onConfirm({ total_parcelas: n, data_primeira_parcela: dataPrimeira, metodo: metodo || undefined })}
        >
          Confirmar renegociação
        </Button>
    </AppDialogActions>
    </>
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
      {open && conta && <FormRenegociar key={conta.id} conta={conta} receber={receber} onConfirm={onConfirm} onCancel={onClose} />}
    </AppDialog>
  );
}
