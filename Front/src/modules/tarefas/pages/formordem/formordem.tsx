import * as React from "react";
import {
  Alert, Autocomplete, Box, Button, CircularProgress, Collapse, Divider, IconButton, InputAdornment,
  MenuItem, Stack, TextField, Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import { useConfirm } from "../../../../context/ConfirmContext";
import { useToast } from "../../../../context/ToastContext";
import { paths } from "../../../../routes/paths";
import { atualizarOrdem, criarOrdem } from "../../api/api";

// ─── Tipos ─────────────────────────────────────────────────────────────────

type Item = {
  id: string;
  tipo_item: "servico" | "peca";
  nome: string;
  servico_id?: number | null;
  peca_id?: number | null;
  preco_unitario: number;
  quantidade: number;
  subtotal: number;
};

type Opcao = { id: number; nome: string };

/** Dados que outras telas passam pelo `state` da navegação para abrir a OS já preenchida. */
export type PresetOrdem = {
  cliente_id?: number;
  cliente?: { id: number; nome: string };
  veiculo_id?: number;
  funcionario_id?: number;
  observacoes?: string;
  itens?: any[];
  /** Orçamento de origem: é marcado como aprovado quando a OS é criada. */
  orcamento_id?: number;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

const mapItens = (itens: any[] = []): Item[] =>
  itens.map((i: any) => ({
    id: String(i.id ?? `${i.tipo_item}-${i.servico_id ?? i.peca_id}-${Math.random()}`),
    tipo_item: i.tipo_item,
    nome: i.nome ?? i.servico?.nome ?? i.peca?.nome ?? "—",
    servico_id: i.servico_id ?? i.servico?.id ?? null,
    peca_id: i.peca_id ?? i.peca?.id ?? null,
    preco_unitario: Number(i.preco_unitario),
    quantidade: Number(i.quantidade),
    subtotal: Number(i.subtotal),
  }));

// ─── Página ────────────────────────────────────────────────────────────────

/** Nova OS (`/ordens/nova`, aceita preenchimento via `state`) e edição (`/ordens/:id/editar`). */
export default function FormOrdemServico() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const location = useLocation();
  const preset = (location.state ?? null) as PresetOrdem | null;
  const nav = useNavigate();
  const { user } = useAuth();
  const confirm = useConfirm();
  const { success, error } = useToast();

  const [carregando, setCarregando] = React.useState(isEdit);
  const [clienteId, setClienteId] = React.useState(0);
  const [clienteValue, setClienteValue] = React.useState<Opcao | null>(null);
  const [clienteInput, setClienteInput] = React.useState("");
  const [clienteOptions, setClienteOptions] = React.useState<Opcao[]>([]);
  const [clienteLoading, setClienteLoading] = React.useState(false);

  const [veiculoId, setVeiculoId] = React.useState(0);
  const [veiculos, setVeiculos] = React.useState<any[]>([]);
  const [veiculoLoading, setVeiculoLoading] = React.useState(false);

  const [funcionarioId, setFuncionarioId] = React.useState(0);
  const [funcionarioValue, setFuncionarioValue] = React.useState<Opcao | null>(null);
  const [funcionarios, setFuncionarios] = React.useState<Opcao[]>([]);

  const [observacoes, setObservacoes] = React.useState("");
  const [itens, setItens] = React.useState<Item[]>([]);
  const [selecaoAberta, setSelecaoAberta] = React.useState<null | "servico" | "peca">(null);
  const [servicos, setServicos] = React.useState<any[]>([]);
  const [selecionadoItem, setSelecionadoItem] = React.useState<any | null>(null);
  const [itemInput, setItemInput] = React.useState("");
  const [itemOptions, setItemOptions] = React.useState<any[]>([]);
  const [itemLoading, setItemLoading] = React.useState(false);

  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const tocado = React.useRef(false);

  const aplicar = React.useCallback((origem: any) => {
    const cId = Number(origem?.cliente_id ?? origem?.cliente?.id ?? 0);
    setClienteId(cId);
    setClienteValue(cId ? { id: cId, nome: origem?.cliente?.nome ?? String(cId) } : null);
    setVeiculoId(Number(origem?.veiculo_id ?? origem?.veiculo?.id ?? 0));
    setFuncionarioId(Number(origem?.funcionario_id ?? origem?.funcionario?.id ?? 0));
    setObservacoes(origem?.observacoes || "");
    setItens(mapItens(origem?.itens));
  }, []);

  // Edição: carrega a OS. Criação: aplica o que veio de quem abriu a página (cliente, veículo, orçamento...).
  React.useEffect(() => {
    if (!isEdit) { if (preset) aplicar(preset); return; }
    let ativo = true;
    api.get(`/ordens/${id}`)
      .then((res) => { if (ativo) aplicar(res.data); })
      .catch(() => { if (ativo) error("Não foi possível carregar a ordem de serviço."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  React.useEffect(() => {
    const params = { oficina_id: user?.oficina_id };
    Promise.all([api.get("/funcionarios", { params }), api.get("/servicos", { params })])
      .then(([func, serv]) => {
        setFuncionarios(func.data.map((f: any) => ({ id: Number(f.id), nome: f.nome })));
        setServicos(serv.data);
      })
      .catch((err) => console.error("Erro ao carregar listas:", err));
  }, [user?.oficina_id]);

  React.useEffect(() => {
    if (!clienteId) { setVeiculos([]); return; }
    setVeiculoLoading(true);
    api.get("/veiculos", { params: { cliente_id: clienteId } })
      .then((res) => setVeiculos(res.data))
      .catch(() => setVeiculos([]))
      .finally(() => setVeiculoLoading(false));
  }, [clienteId]);

  React.useEffect(() => {
    if (clienteInput.trim().length < 2) { setClienteOptions([]); return; }
    const timer = setTimeout(async () => {
      setClienteLoading(true);
      try {
        const { data } = await api.get("/clientes", { params: { search: clienteInput } });
        setClienteOptions(data.map((c: any) => ({ id: Number(c.id), nome: c.nome })));
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
        const { data } = await api.get("/pecas", { params: { search: itemInput, oficina_id: user?.oficina_id } });
        setItemOptions(data);
      } catch (err) {
        console.error("Erro ao buscar peças:", err);
      } finally {
        setItemLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [itemInput, selecaoAberta, user?.oficina_id]);

  React.useEffect(() => {
    if (funcionarioId && funcionarios.length > 0 && !funcionarioValue) {
      const f = funcionarios.find((x) => x.id === funcionarioId);
      if (f) setFuncionarioValue(f);
    }
  }, [funcionarios, funcionarioId, funcionarioValue]);

  const total = itens.reduce((s, i) => s + i.subtotal, 0);
  const totalServicos = itens.filter((i) => i.tipo_item === "servico").reduce((s, i) => s + i.subtotal, 0);
  const totalPecas = itens.filter((i) => i.tipo_item === "peca").reduce((s, i) => s + i.subtotal, 0);
  const veiculoSelecionado = veiculos.find((v) => v.id === veiculoId);
  const erros = {
    cliente: !clienteId ? "Selecione o cliente" : "",
    veiculo: !veiculoId ? "Selecione o veículo" : "",
    funcionario: !funcionarioId ? "Selecione o responsável" : "",
  };
  const temErro = Boolean(erros.cliente || erros.veiculo || erros.funcionario);

  const voltar = async () => {
    if (tocado.current) {
      const descartar = await confirm({
        title: "Descartar alterações?",
        message: "O que você preencheu nesta ordem de serviço será perdido.",
        confirmLabel: "Descartar",
        cancelLabel: "Continuar editando",
        variant: "warning",
      });
      if (!descartar) return;
    }
    if (location.key !== "default") nav(-1);
    else nav(isEdit ? `/ordens/${id}` : paths.tasks);
  };

  const abrirSelecao = (tipo: "servico" | "peca") => {
    setSelecaoAberta(selecaoAberta === tipo ? null : tipo);
    setSelecionadoItem(null);
    setItemInput("");
    setItemOptions([]);
  };

  const handleAddItem = () => {
    if (!selecionadoItem || !selecaoAberta) return;
    if (itens.some((i) => i.tipo_item === selecaoAberta && i.nome === selecionadoItem.nome)) return;
    const preco = Number(selecionadoItem.preco_venda ?? selecionadoItem.preco ?? 0);
    const idCampo = selecaoAberta === "servico" ? "servico_id" : "peca_id";
    tocado.current = true;
    setItens((prev) => [
      ...prev,
      { id: String(Date.now()), tipo_item: selecaoAberta, nome: selecionadoItem.nome, [idCampo]: selecionadoItem.id, preco_unitario: preco, quantidade: 1, subtotal: preco },
    ]);
    setSelecionadoItem(null);
    setItemInput("");
    setItemOptions([]);
    setSelecaoAberta(null);
  };

  const handleQtdChange = (itemId: string, qtd: number) => {
    const q = Math.max(1, qtd || 1);
    setItens((p) => p.map((x) => (x.id === itemId ? { ...x, quantidade: q, subtotal: q * x.preco_unitario } : x)));
  };

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    if (temErro) return;
    const payload = {
      oficina_id: user?.oficina_id,
      cliente_id: clienteId,
      veiculo_id: veiculoId,
      funcionario_id: funcionarioId,
      observacoes,
      valor_total: total,
      itens: itens.map((i) => ({
        tipo_item: i.tipo_item,
        servico_id: i.servico_id ?? null,
        peca_id: i.peca_id ?? null,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        subtotal: i.subtotal,
      })),
    };
    setSalvando(true);
    try {
      if (isEdit) {
        await atualizarOrdem(Number(id), payload);
        success("OS atualizada com sucesso!");
        nav(`/ordens/${id}`, { replace: true });
      } else {
        const nova = await criarOrdem(payload);
        if (preset?.orcamento_id) await api.patch(`/orcamentos/${preset.orcamento_id}/status`, { status: "aprovado" });
        success(preset?.orcamento_id ? `O.S. criada com sucesso para ${clienteValue?.nome ?? "o cliente"}!` : "Ordem de serviço criada!");
        nav(`/ordens/${nova.id}`, { replace: true });
      }
    } catch (err) {
      console.error("Erro ao salvar ordem:", err);
      error(isEdit ? "Não foi possível atualizar a OS." : preset?.orcamento_id ? "Não foi possível converter o orçamento em O.S." : "Não foi possível criar a ordem de serviço.");
      setSalvando(false);
    }
  };

  if (carregando) return <Box sx={{ textAlign: "center", mt: 8 }}><CircularProgress /></Box>;

  const titulo = isEdit ? "Editar ordem de serviço" : "Nova ordem de serviço";

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }} onInputCapture={() => { tocado.current = true; }}>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={4}>
        <IconButton onClick={voltar} size="small" aria-label="Voltar" sx={{ bgcolor: "action.hover", borderRadius: 2 }}>
          <ArrowBackRoundedIcon fontSize="small" />
        </IconButton>
        <Stack minWidth={0}>
          <Typography variant="h5" fontWeight={700} noWrap>{titulo}{isEdit ? ` #${id}` : ""}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {preset?.orcamento_id ? `Gerada a partir do orçamento #${preset.orcamento_id}.` : "Defina cliente, veículo, responsável, serviços e peças."}
          </Typography>
        </Stack>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 320px" }, gap: { xs: 0, md: 6 }, alignItems: "start" }}>
        {/* ── Formulário ── */}
        <Box>
          <Secao titulo="Cliente, veículo e responsável">
            <Stack spacing={2}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                <Autocomplete
                  fullWidth size="small"
                  options={clienteOptions}
                  getOptionLabel={(o) => o.nome}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  value={clienteValue}
                  onChange={(_, v) => { tocado.current = true; setClienteValue(v); setClienteId(v?.id ?? 0); setVeiculoId(0); if (!v) setVeiculos([]); }}
                  inputValue={clienteInput}
                  onInputChange={(_, v) => setClienteInput(v)}
                  filterOptions={(x) => x}
                  loading={clienteLoading}
                  noOptionsText={clienteInput.trim().length < 2 ? "Digite 2+ letras para buscar" : "Nenhum cliente encontrado"}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Cliente *"
                      error={submitAttempted && !!erros.cliente}
                      helperText={submitAttempted ? erros.cliente : undefined}
                      InputProps={{ ...params.InputProps, endAdornment: (<>{clienteLoading && <CircularProgress size={16} />}{params.InputProps.endAdornment}</>) }}
                    />
                  )}
                />
                <TextField
                  select label="Veículo *" value={veiculoId}
                  onChange={(e) => setVeiculoId(Number(e.target.value))}
                  fullWidth size="small" disabled={!clienteId}
                  error={submitAttempted && !!erros.veiculo}
                  helperText={submitAttempted && erros.veiculo ? erros.veiculo : !clienteId ? "Selecione um cliente primeiro" : undefined}
                  InputProps={{ startAdornment: veiculoLoading ? <InputAdornment position="start"><CircularProgress size={14} /></InputAdornment> : undefined }}
                >
                  <MenuItem value={0} disabled>{clienteId ? "Selecione o veículo" : "Selecione o cliente primeiro"}</MenuItem>
                  {veiculos.map((v) => <MenuItem key={v.id} value={v.id}>{v.modelo} — {v.placa}</MenuItem>)}
                </TextField>
              </Box>
              <Autocomplete
                fullWidth size="small"
                options={funcionarios}
                getOptionLabel={(o) => o.nome}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={funcionarioValue}
                onChange={(_, v) => { tocado.current = true; setFuncionarioValue(v); setFuncionarioId(v?.id ?? 0); }}
                noOptionsText="Nenhum funcionário encontrado"
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Responsável / mecânico *"
                    error={submitAttempted && !!erros.funcionario}
                    helperText={submitAttempted ? erros.funcionario : undefined}
                  />
                )}
              />
            </Stack>
          </Secao>

          <Secao
            titulo="Itens da ordem de serviço"
            acao={
              <Stack direction="row" spacing={1}>
                <Button size="small" startIcon={<AddRoundedIcon />} variant={selecaoAberta === "servico" ? "contained" : "outlined"} disableElevation onClick={() => abrirSelecao("servico")}>
                  Mão de obra
                </Button>
                <Button size="small" startIcon={<AddRoundedIcon />} variant={selecaoAberta === "peca" ? "contained" : "outlined"} color="secondary" disableElevation onClick={() => abrirSelecao("peca")}>
                  Peças
                </Button>
              </Stack>
            }
          >
            {selecaoAberta && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mb={2}>
                <Autocomplete
                  fullWidth size="small"
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
                      label={selecaoAberta === "servico" ? "Pesquisar serviço" : "Pesquisar peça"}
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
                        {item.tipo_item === "servico" ? "Mão de obra" : "Peça"} • {brl(item.preco_unitario)}
                      </Typography>
                    </Box>
                    <TextField
                      type="number" label="Qtd" size="small" value={item.quantidade}
                      onChange={(e) => handleQtdChange(item.id, Number(e.target.value))}
                      inputProps={{ min: 1 }}
                      sx={{ width: { xs: "100%", sm: 92 } }}
                    />
                    <Typography variant="body2" fontWeight={700} sx={{ minWidth: 110, textAlign: { xs: "left", sm: "right" } }}>
                      {brl(item.subtotal)}
                    </Typography>
                    <IconButton color="error" size="small" aria-label={`Remover ${item.nome}`} onClick={() => { tocado.current = true; setItens((p) => p.filter((x) => x.id !== item.id)); }}>
                      <DeleteRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Adicione serviços e peças para a ordem de serviço.</Typography>
            )}
          </Secao>

          <Secao titulo="Observações / check-list de entrada">
            <TextField
              placeholder="Anotações sobre o veículo, o que o cliente relatou, itens verificados na entrada…"
              inputProps={{ "aria-label": "Observações" }}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              fullWidth multiline rows={3} size="small"
            />
          </Secao>

          <Collapse in={submitAttempted && temErro}>
            <Alert severity="error" sx={{ mb: 3, borderRadius: 1.5 }}>Preencha cliente, veículo e responsável antes de salvar.</Alert>
          </Collapse>
        </Box>

        {/* ── Resumo ── */}
        <Box sx={{ position: { md: "sticky" }, top: { md: 24 } }}>
          <Secao titulo="Resumo">
            <Stack spacing={1.25}>
              <LinhaResumo rotulo="Cliente" valor={clienteValue?.nome ?? "—"} />
              <LinhaResumo rotulo="Veículo" valor={veiculoSelecionado ? `${veiculoSelecionado.modelo} · ${veiculoSelecionado.placa}` : "—"} />
              <LinhaResumo rotulo="Responsável" valor={funcionarioValue?.nome ?? "—"} />
              <LinhaResumo rotulo="Itens" valor={itens.length || "—"} />
              <Divider />
              <LinhaResumo rotulo="Mão de obra" valor={totalServicos > 0 ? brl(totalServicos) : "—"} />
              <LinhaResumo rotulo="Peças" valor={totalPecas > 0 ? brl(totalPecas) : "—"} />
              <Divider />
              <LinhaResumo rotulo="Total" valor={brl(total)} forte />
            </Stack>
          </Secao>

          <Stack direction="row" spacing={1.5} justifyContent="flex-end">
            <Button variant="outlined" onClick={voltar} disabled={salvando}>Cancelar</Button>
            <Button variant="contained" disableElevation onClick={handleSubmit} disabled={salvando} sx={{ fontWeight: 700 }}>
              {salvando ? "Salvando…" : isEdit ? "Salvar alterações" : "Gerar ordem de serviço"}
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
