import * as React from "react";
import {
  Alert, Autocomplete, Box, Button, CircularProgress, Collapse, Divider, IconButton, InputAdornment,
  MenuItem, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import { useNavigate } from "react-router-dom";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import { useConfirm } from "../../../../context/ConfirmContext";
import { useToast } from "../../../../context/ToastContext";
import { paths } from "../../../../routes/paths";
import CampoData from "../../../../components/common/CampoData";
import ClientDialog, { type ClientForm } from "../../../clientes/dialog";
import VeiculoDialog, { type VeiculoForm } from "../../../veiculos/dialog";
import { criarVeiculo } from "../../../veiculos/api/api";

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type OrcamentoItem = {
  id: string | number;
  tipo_item: "servico" | "peca";
  nome: string;
  servico_id?: number | null;
  peca_id?: number | null;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatPreco(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return (parseFloat(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parsePreco(formatted: string): number {
  return parseFloat(formatted.replace(/\./g, "").replace(",", ".")) || 0;
}

/** Data local (YYYY-MM-DD) daqui a `dias`; toISOString usaria UTC e viraria o dia depois das 21h no Brasil. */
function hojeMais(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Seção da página: título em negrito com linha fina embaixo e o conteúdo em seguida. */
function Secao({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 4 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pb: 1, mb: 2, borderBottom: (t) => `1px solid ${t.palette.divider}` }}>
        <Typography fontWeight={700}>{titulo}</Typography>
        {acao}
      </Stack>
      {children}
    </Box>
  );
}

function LinhaResumo({ rotulo, valor, forte = false }: { rotulo: string; valor: React.ReactNode; forte?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2}>
      <Typography variant="body2" color="text.secondary">{rotulo}</Typography>
      <Typography variant="body2" fontWeight={forte ? 800 : 600} sx={{ fontSize: forte ? 20 : undefined, textAlign: "right" }}>{valor}</Typography>
    </Stack>
  );
}

// ─── Página ────────────────────────────────────────────────────────────────

export default function NovoOrcamento() {
  const nav = useNavigate();
  const { user } = useAuth();
  const confirm = useConfirm();
  const { success, error } = useToast();

  const [veiculos, setVeiculos] = React.useState<{ id: number; modelo: string; placa: string }[]>([]);
  const [servicos, setServicos] = React.useState<any[]>([]);
  const [loadingVeiculos, setLoadingVeiculos] = React.useState(false);

  const [clienteId, setClienteId] = React.useState<number>(0);
  const [clienteValue, setClienteValue] = React.useState<{ id: number; nome: string } | null>(null);
  const [clienteInput, setClienteInput] = React.useState("");
  const [clienteOptions, setClienteOptions] = React.useState<{ id: number; nome: string }[]>([]);
  const [clienteLoading, setClienteLoading] = React.useState(false);

  const [veiculoId, setVeiculoId] = React.useState<number>(0);
  const [descricao, setDescricao] = React.useState("");
  const [precoFormatado, setPrecoFormatado] = React.useState("");
  const [data, setData] = React.useState(hojeMais(0));
  const [validade, setValidade] = React.useState(hojeMais(7));
  const [itens, setItens] = React.useState<OrcamentoItem[]>([]);
  const [selecaoAberta, setSelecaoAberta] = React.useState<null | "servico" | "peca">(null);
  const [selecionadoItem, setSelecionadoItem] = React.useState<any | null>(null);
  const [itemInput, setItemInput] = React.useState("");
  const [itemOptions, setItemOptions] = React.useState<any[]>([]);
  const [itemLoading, setItemLoading] = React.useState(false);

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [openNovoCliente, setOpenNovoCliente] = React.useState(false);
  const [openNovoVeiculo, setOpenNovoVeiculo] = React.useState(false);

  React.useEffect(() => {
    if (!user?.oficina_id) return;
    api.get(`/servicos?oficina_id=${user.oficina_id}`)
      .then((res) => setServicos(res.data ?? []))
      .catch(() => setServicos([]));
  }, [user?.oficina_id]);

  React.useEffect(() => {
    if (clienteInput.trim().length < 2) { setClienteOptions([]); return; }
    const timer = setTimeout(async () => {
      setClienteLoading(true);
      try {
        const { data: res } = await api.get("/clientes", { params: { search: clienteInput } });
        setClienteOptions(res.map((c: any) => ({ id: Number(c.id), nome: c.nome })));
      } catch (err) {
        console.error("Erro ao buscar clientes:", err);
      } finally {
        setClienteLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clienteInput]);

  React.useEffect(() => {
    if (selecaoAberta !== "peca" || itemInput.trim().length < 2) { setItemOptions([]); return; }
    const timer = setTimeout(async () => {
      setItemLoading(true);
      try {
        const { data: res } = await api.get("/pecas", { params: { search: itemInput, oficina_id: user?.oficina_id } });
        setItemOptions(res);
      } catch (err) {
        console.error("Erro ao buscar peças:", err);
      } finally {
        setItemLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [itemInput, selecaoAberta, user?.oficina_id]);

  React.useEffect(() => {
    if (!clienteId) { setVeiculos([]); setVeiculoId(0); return; }
    setLoadingVeiculos(true);
    api.get(`/veiculos?cliente_id=${clienteId}`)
      .then((res) => setVeiculos(res.data.map((v: any) => ({ id: v.id, modelo: v.modelo, placa: v.placa }))))
      .catch(() => setVeiculos([]))
      .finally(() => setLoadingVeiculos(false));
  }, [clienteId]);

  const totalItens = itens.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0);
  const totalServicos = itens.filter((i) => i.tipo_item === "servico").reduce((s, i) => s + Number(i.subtotal), 0);
  const totalPecas = itens.filter((i) => i.tipo_item === "peca").reduce((s, i) => s + Number(i.subtotal), 0);
  const valorTotal = totalItens > 0 ? totalItens : parsePreco(precoFormatado);
  const veiculoSelecionado = veiculos.find((v) => v.id === veiculoId);

  const validate = React.useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!clienteId) errs.clienteId = "Selecione o cliente";
    if (!veiculoId) errs.veiculoId = "Selecione o veículo";
    if (!valorTotal || valorTotal <= 0) errs.valor = "Informe um valor válido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [clienteId, veiculoId, valorTotal]);

  React.useEffect(() => {
    if (submitAttempted) validate();
  }, [submitAttempted, validate]);

  const preenchido = Boolean(clienteId || veiculoId || descricao.trim() || itens.length || precoFormatado);

  const voltar = async () => {
    if (preenchido) {
      const descartar = await confirm({
        title: "Descartar orçamento?",
        message: "O que você preencheu neste orçamento será perdido.",
        confirmLabel: "Descartar",
        cancelLabel: "Continuar editando",
        variant: "warning",
      });
      if (!descartar) return;
    }
    nav(paths.orcamentos);
  };

  const handleAddItem = () => {
    if (!selecaoAberta || !selecionadoItem) return;
    const jaExiste = itens.some((item) =>
      item.tipo_item === selecaoAberta &&
      (selecaoAberta === "servico" ? item.servico_id : item.peca_id) === selecionadoItem.id
    );
    if (jaExiste) return;
    const preco = Number(selecionadoItem.preco_venda ?? selecionadoItem.preco ?? 0);
    const idCampo = selecaoAberta === "servico" ? "servico_id" : "peca_id";
    setItens((prev) => [
      ...prev,
      {
        id: `${selecaoAberta}-${selecionadoItem.id}-${Date.now()}`,
        tipo_item: selecaoAberta,
        nome: selecionadoItem.nome,
        [idCampo]: selecionadoItem.id,
        quantidade: 1,
        preco_unitario: preco,
        subtotal: preco,
      },
    ]);
    setSelecaoAberta(null);
    setSelecionadoItem(null);
    setItemInput("");
    setItemOptions([]);
  };

  const handleQtdChange = (id: string | number, quantidade: number) => {
    const qtd = Math.max(1, Number(quantidade) || 1);
    setItens((prev) => prev.map((item) => (item.id === id ? { ...item, quantidade: qtd, subtotal: qtd * Number(item.preco_unitario) } : item)));
  };

  const handleClienteCriado = async (dados: ClientForm) => {
    try {
      const { data: res } = await api.post("/clientes", dados);
      const novo = { id: Number(res.id), nome: res.nome };
      setClienteValue(novo);
      setClienteId(novo.id);
      setClienteInput(novo.nome);
      setClienteOptions((prev) => [novo, ...prev]);
      setOpenNovoCliente(false);
    } catch (err) {
      console.error("Erro ao criar cliente:", err);
      error("Não foi possível criar o cliente.");
    }
  };

  const handleVeiculoCriado = async (dados: VeiculoForm) => {
    if (!user?.oficina_id) return;
    try {
      const novo = await criarVeiculo({ ...dados, cliente_id: clienteId }, user.oficina_id);
      const veiculoNovo = { id: Number(novo.id), modelo: novo.modelo, placa: novo.placa };
      setVeiculos((prev) => [veiculoNovo, ...prev]);
      setVeiculoId(veiculoNovo.id);
      setOpenNovoVeiculo(false);
    } catch (err) {
      console.error("Erro ao criar veículo:", err);
      error("Não foi possível criar o veículo.");
    }
  };

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    if (!validate()) return;
    setSalvando(true);
    try {
      const res = await api.post("/orcamentos", {
        clienteId, veiculoId,
        descricao: descricao.trim(),
        valor: valorTotal,
        data,
        validade: validade || null,
        itens,
      });
      success("Orçamento criado com sucesso!");
      nav(`/orcamentos/${res.data.id}`, { replace: true });
    } catch (err) {
      console.error(err);
      error("Não foi possível criar o orçamento.");
      setSalvando(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={4}>
        <IconButton onClick={voltar} size="small" aria-label="Voltar" sx={{ bgcolor: "action.hover", borderRadius: 2 }}>
          <ArrowBackRoundedIcon fontSize="small" />
        </IconButton>
        <Stack minWidth={0}>
          <Typography variant="h5" fontWeight={700} noWrap>Novo orçamento</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>Monte a proposta com cliente, veículo, serviços e peças.</Typography>
        </Stack>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 320px" }, gap: { xs: 0, md: 6 }, alignItems: "start" }}>
        {/* ── Formulário ── */}
        <Box>
          <Secao titulo="Cliente e veículo">
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <Autocomplete
                fullWidth
                size="small"
                options={clienteOptions}
                getOptionLabel={(o) => o.nome}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={clienteValue}
                onChange={(_, v) => { setClienteValue(v); setClienteId(v?.id ?? 0); setVeiculoId(0); }}
                inputValue={clienteInput}
                onInputChange={(_, v) => setClienteInput(v)}
                filterOptions={(x) => x}
                loading={clienteLoading}
                noOptionsText={clienteInput.trim().length < 2 ? "Digite 2+ letras para buscar" : "Nenhum cliente encontrado"}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Cliente *"
                    error={!!errors.clienteId}
                    helperText={errors.clienteId}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {clienteLoading && <CircularProgress size={16} />}
                          {params.InputProps.endAdornment}
                          <InputAdornment position="end">
                            <Tooltip title="Criar novo cliente">
                              <IconButton
                                size="small"
                                aria-label="Criar novo cliente"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); setOpenNovoCliente(true); }}
                                sx={{ color: "primary.main", p: 0.25 }}
                              >
                                <AddRoundedIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          </InputAdornment>
                        </>
                      ),
                    }}
                  />
                )}
              />

              <TextField
                select
                label="Veículo *"
                value={veiculoId}
                onChange={(e) => {
                  if (e.target.value === "__new__") { setOpenNovoVeiculo(true); return; }
                  setVeiculoId(Number(e.target.value));
                }}
                size="small"
                fullWidth
                disabled={!clienteId}
                error={!!errors.veiculoId}
                helperText={errors.veiculoId || (!clienteId ? "Selecione um cliente primeiro" : undefined)}
                InputProps={{ startAdornment: loadingVeiculos ? <InputAdornment position="start"><CircularProgress size={14} /></InputAdornment> : undefined }}
              >
                {clienteId && (
                  <MenuItem value="__new__" sx={{ color: "primary.main", fontWeight: 700 }}>
                    <AddRoundedIcon fontSize="small" sx={{ mr: 1 }} />
                    Cadastrar novo veículo
                  </MenuItem>
                )}
                {veiculos.length === 0 ? (
                  <MenuItem disabled value={0}>{clienteId ? "Nenhum veículo encontrado" : "Selecione o cliente primeiro"}</MenuItem>
                ) : (
                  veiculos.map((v) => (
                    <MenuItem key={v.id} value={v.id}>
                      {v.modelo}
                      <Box component="span" sx={{ ml: 1, px: 0.75, py: 0.1, borderRadius: 1, bgcolor: (t) => alpha(t.palette.text.primary, 0.07), fontFamily: "monospace", fontWeight: 600, fontSize: 12 }}>
                        {v.placa}
                      </Box>
                    </MenuItem>
                  ))
                )}
              </TextField>
            </Box>
          </Secao>

          <Secao
            titulo="Itens do orçamento"
            acao={
              <Stack direction="row" spacing={1}>
                <Button size="small" startIcon={<AddRoundedIcon />} variant={selecaoAberta === "servico" ? "contained" : "outlined"} disableElevation onClick={() => setSelecaoAberta(selecaoAberta === "servico" ? null : "servico")}>
                  Mão de obra
                </Button>
                <Button size="small" startIcon={<AddRoundedIcon />} variant={selecaoAberta === "peca" ? "contained" : "outlined"} color="secondary" disableElevation onClick={() => setSelecaoAberta(selecaoAberta === "peca" ? null : "peca")}>
                  Peças
                </Button>
              </Stack>
            }
          >
            {selecaoAberta && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mb={2}>
                <Autocomplete
                  fullWidth
                  size="small"
                  options={selecaoAberta === "servico" ? servicos : itemOptions}
                  getOptionLabel={(o) => `${o.nome} — R$ ${Number(o.preco_venda ?? o.preco ?? 0).toFixed(2)}`}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  value={selecionadoItem}
                  onChange={(_, v) => setSelecionadoItem(v)}
                  inputValue={itemInput}
                  onInputChange={(_, v) => setItemInput(v)}
                  filterOptions={selecaoAberta === "peca" ? (x) => x : undefined}
                  loading={itemLoading}
                  noOptionsText={
                    selecaoAberta === "peca" && itemInput.trim().length < 2
                      ? "Digite 2+ letras para buscar"
                      : `Nenhum${selecaoAberta === "servico" ? " serviço" : "a peça"} encontrado(a)`
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      autoFocus
                      label={selecaoAberta === "servico" ? "Selecionar serviço" : "Selecionar peça"}
                      InputProps={{ ...params.InputProps, endAdornment: (<>{itemLoading && <CircularProgress size={16} />}{params.InputProps.endAdornment}</>) }}
                    />
                  )}
                />
                <Button variant="contained" disableElevation onClick={handleAddItem} sx={{ px: 3 }}>Adicionar</Button>
              </Stack>
            )}

            {itens.length ? (
              <Stack divider={<Divider />}>
                {itens.map((item) => (
                  <Stack key={item.id} direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }} sx={{ py: 1.5 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{item.nome}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.tipo_item === "servico" ? "Mão de obra" : "Peça"} • {brl(Number(item.preco_unitario))}
                      </Typography>
                    </Box>
                    <TextField
                      type="number"
                      label="Qtd"
                      size="small"
                      value={item.quantidade}
                      onChange={(e) => handleQtdChange(item.id, Number(e.target.value))}
                      inputProps={{ min: 1 }}
                      sx={{ width: { xs: "100%", sm: 92 } }}
                    />
                    <Typography variant="body2" fontWeight={700} sx={{ minWidth: 110, textAlign: { xs: "left", sm: "right" } }}>
                      {brl(Number(item.subtotal))}
                    </Typography>
                    <IconButton color="error" size="small" aria-label={`Remover ${item.nome}`} onClick={() => setItens((prev) => prev.filter((i) => i.id !== item.id))}>
                      <DeleteRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                Adicione serviços e peças para o orçamento.
              </Typography>
            )}
          </Secao>

          <Secao titulo="Detalhes do orçamento">
            <Stack spacing={2}>
              <TextField
                label="Descrição dos serviços"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                size="small"
                fullWidth
                multiline
                rows={3}
              />
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                <CampoData label="Data do orçamento" value={data} onChange={setData} />
                <CampoData label="Válido até" value={validade} onChange={setValidade} />
              </Box>
              {totalItens === 0 && (
                <TextField
                  label="Valor total *"
                  value={precoFormatado}
                  onChange={(e) => setPrecoFormatado(formatPreco(e.target.value))}
                  size="small"
                  fullWidth
                  error={!!errors.valor}
                  helperText={errors.valor ?? "Sem itens, informe o valor manualmente."}
                  inputProps={{ inputMode: "numeric" }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Typography variant="body2" color="text.secondary" fontWeight={600}>R$</Typography></InputAdornment> }}
                />
              )}
            </Stack>
          </Secao>

          <Collapse in={submitAttempted && Object.keys(errors).length > 0}>
            <Alert severity="error" sx={{ mb: 3, borderRadius: 1.5 }}>Preencha todos os campos obrigatórios antes de salvar.</Alert>
          </Collapse>
        </Box>

        {/* ── Resumo ── */}
        <Box sx={{ position: { md: "sticky" }, top: { md: 24 } }}>
          <Secao titulo="Resumo">
            <Stack spacing={1.25}>
              <LinhaResumo rotulo="Cliente" valor={clienteValue?.nome ?? "—"} />
              <LinhaResumo rotulo="Veículo" valor={veiculoSelecionado ? `${veiculoSelecionado.modelo} · ${veiculoSelecionado.placa}` : "—"} />
              <LinhaResumo rotulo="Itens" valor={itens.length || "—"} />
              <Divider />
              <LinhaResumo rotulo="Mão de obra" valor={totalServicos > 0 ? brl(totalServicos) : "—"} />
              <LinhaResumo rotulo="Peças" valor={totalPecas > 0 ? brl(totalPecas) : "—"} />
              <Divider />
              <LinhaResumo rotulo="Valor total" valor={valorTotal > 0 ? brl(valorTotal) : "—"} forte />
            </Stack>
          </Secao>

          <Stack direction="row" spacing={1.5} justifyContent="flex-end">
            <Button variant="outlined" onClick={voltar} disabled={salvando}>Cancelar</Button>
            <Button variant="contained" disableElevation onClick={handleSubmit} disabled={salvando} sx={{ fontWeight: 700 }}>
              {salvando ? "Criando…" : "Criar orçamento"}
            </Button>
          </Stack>
        </Box>
      </Box>

      <ClientDialog open={openNovoCliente} mode="create" onClose={() => setOpenNovoCliente(false)} onSubmit={handleClienteCriado} />
      <VeiculoDialog open={openNovoVeiculo} mode="create" defaultCliente={clienteValue} onClose={() => setOpenNovoVeiculo(false)} onSubmit={handleVeiculoCriado} />
    </Box>
  );
}
