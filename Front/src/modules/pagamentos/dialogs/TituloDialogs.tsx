import * as React from "react";
import { Box, Button, CircularProgress, Collapse, Divider, FormControlLabel, InputAdornment, MenuItem, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import { AppDialog, AppDialogActions, AppDialogContent } from "../../../components/common/AppDialog";
import CampoData from "../../../components/common/CampoData";
import TextoLimitado from "../../../components/common/TextoLimitado";
import { METODO_OPTIONS, brl, ehCartao, formatarData, hojeInput, type Conta } from "../api/api";
import { aceitaMetodo, listarMaquininhas, pct, type Maquininha } from "../../configuracoes/api/maquininhas";
import { formatPreco, maskDecimal, parseDecimal, parsePreco, precoParaCampo } from "../../../utils/masks";

const toCents = (v: number) => Math.round(v * 100);

function LinhaResumo({ rotulo, valor, forte = false }: { rotulo: string; valor: React.ReactNode; forte?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2}>
      <Typography variant="body2" color="text.secondary">{rotulo}</Typography>
      <Typography variant="body2" fontWeight={forte ? 800 : 600} sx={{ fontSize: forte ? 15 : undefined }}>{valor}</Typography>
    </Stack>
  );
}

type Unidade = "valor" | "percentual";

/** Alterna o campo entre valor em reais e percentual (do valor original do título). */
function SeletorUnidade({ valor, onChange, rotulo }: { valor: Unidade; onChange: (u: Unidade) => void; rotulo: string }) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={valor}
      onChange={(_, u: Unidade | null) => u && onChange(u)}
      aria-label={rotulo}
      sx={{ "& .MuiToggleButton-root": { px: 1, py: 0.25, fontSize: 12, fontWeight: 700, lineHeight: 1.4 } }}
    >
      <ToggleButton value="valor" aria-label="Em reais">R$</ToggleButton>
      <ToggleButton value="percentual" aria-label="Em porcentagem">%</ToggleButton>
    </ToggleButtonGroup>
  );
}

/** Converte o que foi digitado em reais; percentual é calculado sobre o valor original e arredondado ao centavo. */
const emReais = (texto: string, unidade: Unidade, base: number) =>
  unidade === "percentual" ? Math.round(base * parseDecimal(texto)) / 100 : parsePreco(texto);

/** Reais usam a máscara de moeda; percentual é um decimal livre que aceita vírgula. */
const mascarar = (texto: string, unidade: Unidade) => (unidade === "percentual" ? maskDecimal(texto) : formatPreco(texto));

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
  maquininha_id?: number;
  cartao_parcelas?: number;
  valor?: number;
  data_pagamento?: string;
  desconto?: number;
  motivo_desconto?: string;
  multa?: number;
};

/** Maquininhas ativas, buscadas uma vez por abertura do modal. null = carregando; erro vira lista vazia. */
function useMaquininhasAtivas(ativo: boolean) {
  const [lista, setLista] = React.useState<Maquininha[] | null>(ativo ? null : []);
  React.useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    listarMaquininhas()
      .then((l) => { if (vivo) setLista(Array.isArray(l) ? l : []); })
      .catch(() => { if (vivo) setLista([]); });
    return () => { vivo = false; };
  }, [ativo]);
  return lista;
}

/** Taxa, líquido e previsão de um recebimento no cartão; mesma regra do servidor (que é quem grava). */
export function simularTaxa(m: Maquininha, metodo: string, parcelas: number, valor: number, dataIso: string) {
  const debito = metodo === "cartao_debito";
  const percentual = debito ? m.taxa_debito : m.taxas_credito[parcelas - 1] ?? 0;
  const prazo = debito ? m.prazo_debito_dias : m.antecipacao ? m.prazo_credito_dias : m.prazo_credito_dias + (m.intervalo_parcelas_dias ?? 30) * (parcelas - 1);
  const taxa = Math.round(valor * percentual) / 100;
  const previsao = new Date(`${dataIso || hojeInput()}T00:00:00.000Z`);
  previsao.setUTCDate(previsao.getUTCDate() + prazo);
  return { percentual, taxa, liquido: valor - taxa, previsao: previsao.toISOString() };
}

function FormReceber({ conta, receber, onConfirm, onCancel }: { conta: Conta; receber: boolean; onConfirm: (d: DadosReceber) => void | Promise<void>; onCancel: () => void }) {
  const original = Number(conta.valor_original);
  const jaPago = Number(conta.valor_pago);
  const descontoAtual = Number(conta.desconto);
  const multaAtual = Number(conta.multa ?? 0);

  // O desconto só aparece quando ligado; um título que já tem desconto abre com ele ligado.
  const [comDesconto, setComDesconto] = React.useState(descontoAtual > 0);
  const [descontoStr, setDescontoStr] = React.useState(precoParaCampo(descontoAtual));
  const [motivo, setMotivo] = React.useState(conta.motivo_desconto ?? "");
  // A multa funciona como o desconto, só que soma ao valor e não pede motivo.
  const [comMulta, setComMulta] = React.useState(multaAtual > 0);
  const [multaStr, setMultaStr] = React.useState(precoParaCampo(multaAtual));
  // Desconto e multa podem ser digitados em reais ou em % do valor original; sempre viajam em reais.
  const [descontoUnidade, setDescontoUnidade] = React.useState<Unidade>("valor");
  const [multaUnidade, setMultaUnidade] = React.useState<Unidade>("valor");
  const descontoRef = React.useRef<HTMLInputElement>(null);
  const multaRef = React.useRef<HTMLInputElement>(null);
  const [valorStr, setValorStr] = React.useState(() => precoParaCampo(original - descontoAtual + multaAtual - jaPago));
  const [valorEditado, setValorEditado] = React.useState(false);
  const [metodo, setMetodo] = React.useState("");
  const [data, setData] = React.useState(hojeInput);
  // Maquininha só em conta a receber no crédito/débito, e só as que aceitam o método escolhido.
  // Com uma só que aceite, ela já vem escolhida.
  const maquininhas = useMaquininhasAtivas(receber);
  const opcoesMaquininha = React.useMemo(
    () => (maquininhas ?? []).filter((m) => aceitaMetodo(m, metodo)),
    [maquininhas, metodo]
  );
  const [maquininhaId, setMaquininhaId] = React.useState<number | "">("");
  const [parcelasCartao, setParcelasCartao] = React.useState(1);
  React.useEffect(() => {
    // Trocar de método pode tirar a escolhida da lista: aí vale a única que sobrou, ou nenhuma.
    setMaquininhaId((atual) =>
      opcoesMaquininha.some((m) => m.id === atual) ? atual : opcoesMaquininha.length === 1 ? opcoesMaquininha[0].id : ""
    );
  }, [opcoesMaquininha]);
  const usaMaquininha = receber && ehCartao(metodo) && opcoesMaquininha.length > 0;
  const maquininha = usaMaquininha ? opcoesMaquininha.find((m) => m.id === maquininhaId) ?? null : null;
  const maxParcelas = maquininha?.taxas_credito.length ?? 1;
  const parcelasValidas = Math.min(parcelasCartao, maxParcelas);
  // Trava o botão enquanto salva: clique duplo não registra o recebimento duas vezes.
  const [salvando, setSalvando] = React.useState(false);

  const desconto = comDesconto ? emReais(descontoStr, descontoUnidade, original) : 0; // desligado = sem desconto (remove o atual)
  const multa = comMulta ? emReais(multaStr, multaUnidade, original) : 0; // desligada = sem multa (remove a atual)
  const multaVazia = comMulta && multa <= 0; // ligou a multa mas não informou o valor
  const descontoInvalido = desconto < 0 || toCents(desconto) > toCents(original) || toCents(original - desconto + multa) < toCents(jaPago);
  const precisaMotivo = comDesconto && desconto > 0 && !motivo.trim();
  const descontoVazio = comDesconto && desconto <= 0; // ligou o desconto mas não informou o valor
  const saldo = original - (descontoInvalido ? descontoAtual : desconto) + multa - jaPago;
  const semSaldo = toCents(saldo) <= 0; // ex.: desconto de 100%: só confirma a baixa

  // Enquanto o usuário não digitou o valor, ele acompanha o saldo (que muda com o desconto).
  React.useEffect(() => {
    if (!valorEditado) setValorStr(precoParaCampo(saldo));
  }, [saldo, valorEditado]);

  const valor = parsePreco(valorStr);
  const excede = toCents(valor) > toCents(saldo);
  const valorInvalido = !semSaldo && (valor <= 0 || excede);
  const parcial = !semSaldo && !valorInvalido && toCents(valor) < toCents(saldo);
  const faltaMaquininha = usaMaquininha && !maquininha;
  const invalido = descontoInvalido || precisaMotivo || descontoVazio || multaVazia || valorInvalido || !metodo || !data || faltaMaquininha || (receber && ehCartao(metodo) && maquininhas === null);
  const simulacao = maquininha && !semSaldo && valor > 0 ? simularTaxa(maquininha, metodo, parcelasValidas, valor, data) : null;
  const mudouDesconto = toCents(desconto) !== toCents(descontoAtual);
  const mudouMulta = toCents(multa) !== toCents(multaAtual);

  const confirmar = async () => {
    if (salvando || invalido) return;
    setSalvando(true);
    try {
      await onConfirm({
        metodo,
        ...(maquininha ? { maquininha_id: maquininha.id, cartao_parcelas: metodo === "cartao_credito" ? parcelasValidas : 1 } : {}),
        valor: semSaldo ? undefined : valor,
        data_pagamento: data,
        // O desconto só viaja quando mudou; 0 remove o desconto anterior.
        ...(mudouDesconto ? { desconto, motivo_desconto: desconto > 0 ? motivo.trim() : undefined } : {}),
        // A multa também só viaja quando mudou; 0 remove a anterior.
        ...(mudouMulta ? { multa } : {}),
      });
    } catch {
      // Quem chamou já avisou o erro; o modal fica aberto com os dados preenchidos.
    } finally {
      setSalvando(false);
    }
  };

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
                value={valorStr}
                onChange={(e) => { setValorStr(formatPreco(e.target.value)); setValorEditado(true); }}
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
                inputProps={{ inputMode: "decimal" }}
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
            {usaMaquininha && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  select
                  label="Maquininha *"
                  value={maquininhaId}
                  onChange={(e) => setMaquininhaId(Number(e.target.value))}
                  size="small"
                  fullWidth
                  error={faltaMaquininha}
                  helperText={faltaMaquininha ? "Escolha a maquininha usada" : " "}
                >
                  {opcoesMaquininha.map((m) => <MenuItem key={m.id} value={m.id}>{m.nome}</MenuItem>)}
                </TextField>
                {metodo === "cartao_credito" ? (
                  <TextField
                    select
                    label="Parcelas *"
                    value={parcelasValidas}
                    onChange={(e) => setParcelasCartao(Number(e.target.value))}
                    size="small"
                    fullWidth
                    disabled={!maquininha}
                    helperText=" "
                  >
                    {Array.from({ length: maxParcelas }, (_, i) => i + 1).map((n) => (
                      <MenuItem key={n} value={n}>
                        {n === 1 ? "À vista" : `${n}x`}
                        {maquininha && <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>· taxa {pct(maquininha.taxas_credito[n - 1])}</Typography>}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <Box sx={{ width: "100%" }} />
                )}
              </Stack>
            )}
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
                  value={descontoStr}
                  onChange={(e) => setDescontoStr(mascarar(e.target.value, descontoUnidade))}
                  size="small"
                  fullWidth
                  autoFocus
                  inputRef={descontoRef}
                  error={descontoStr !== "" && descontoInvalido}
                  helperText={
                    descontoInvalido
                      ? toCents(desconto) > toCents(original)
                        ? descontoUnidade === "percentual" ? "Máximo: 100%" : `Máximo: ${brl(original)}`
                        : "Deixaria o valor abaixo do que já foi recebido"
                      : descontoUnidade === "percentual" && desconto > 0 ? `= ${brl(desconto)}` : " "
                  }
                  InputProps={{
                    startAdornment: <InputAdornment position="start">{descontoUnidade === "percentual" ? "%" : "R$"}</InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <SeletorUnidade valor={descontoUnidade} rotulo="Unidade do desconto" onChange={(u) => { setDescontoUnidade(u); setDescontoStr(""); setTimeout(() => descontoRef.current?.focus()); }} />
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{ inputMode: "decimal" }}
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
                  value={multaStr}
                  onChange={(e) => setMultaStr(mascarar(e.target.value, multaUnidade))}
                  size="small"
                  fullWidth
                  autoFocus
                  inputRef={multaRef}
                  helperText={multaUnidade === "percentual" && multa > 0 ? `= ${brl(multa)}` : " "}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">{multaUnidade === "percentual" ? "%" : "R$"}</InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <SeletorUnidade valor={multaUnidade} rotulo="Unidade da multa" onChange={(u) => { setMultaUnidade(u); setMultaStr(""); setTimeout(() => multaRef.current?.focus()); }} />
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{ inputMode: "decimal" }}
                />
              </Stack>
            </Collapse>
          </Stack>
        </Stack>
      }
      resumo={
        <Resumo
          conta={conta}
          receber={receber}
          desconto={descontoInvalido ? descontoAtual : desconto}
          multa={multa}
          linhas={
            simulacao && (
              <>
                <Divider />
                <Titulo>Cartão</Titulo>
                <LinhaResumo rotulo={`Taxa da maquininha (${pct(simulacao.percentual)})`} valor={simulacao.taxa > 0 ? `− ${brl(simulacao.taxa)}` : "-"} />
                <LinhaResumo rotulo="Valor líquido" valor={brl(simulacao.liquido)} forte />
                <LinhaResumo rotulo="Previsão de recebimento" valor={formatarData(simulacao.previsao)} />
              </>
            )
          }
        />
      }
    />
    </AppDialogContent>
    <AppDialogActions>
      <Button onClick={onCancel} variant="outlined">Cancelar</Button>
        <Button
          variant="contained"
          disableElevation
          disabled={invalido || salvando}
          startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ fontWeight: 700 }}
          onClick={confirmar}
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
  onConfirm: (d: DadosReceber) => void | Promise<void>;
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

function FormRenegociar({ conta, receber, onConfirm, onCancel }: { conta: Conta; receber: boolean; onConfirm: (d: DadosParcelar) => void | Promise<void>; onCancel: () => void }) {
  const saldo = Number(conta.valor_original) - Number(conta.desconto) + Number(conta.multa ?? 0) - Number(conta.valor_pago);
  const [totalStr, setTotalStr] = React.useState("2");
  const [dataPrimeira, setDataPrimeira] = React.useState("");
  const [metodo, setMetodo] = React.useState("");
  const n = parseInt(totalStr) || 0;
  const invalido = n < 2 || n > 60 || !dataPrimeira;
  // Trava o botão enquanto salva: clique duplo não parcela o título duas vezes.
  const [salvando, setSalvando] = React.useState(false);

  const confirmar = async () => {
    if (salvando || invalido) return;
    setSalvando(true);
    try {
      await onConfirm({ total_parcelas: n, data_primeira_parcela: dataPrimeira, metodo: metodo || undefined });
    } catch {
      // Quem chamou já avisou o erro; o modal fica aberto com os dados preenchidos.
    } finally {
      setSalvando(false);
    }
  };

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
          disabled={invalido || salvando}
          startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ fontWeight: 700 }}
          onClick={confirmar}
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
  onConfirm: (d: DadosParcelar) => void | Promise<void>;
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
