import * as React from "react";
import {
  Stack, TextField,
  Button, IconButton, Typography,
  Grid, InputAdornment,
  Collapse, Alert, Box, CircularProgress, Autocomplete, MenuItem, Divider,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import RequestQuoteRoundedIcon from "@mui/icons-material/RequestQuoteRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import CalendarTodayRoundedIcon from "@mui/icons-material/CalendarTodayRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import api from "../../../api/api";
import { useAuth } from "../../../context/AuthContext";
import { AppDialog, AppDialogActions, AppDialogContent, SectionLabel } from "../../../components/common/AppDialog";

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type OrcamentoForm = {
  clienteId: number;
  veiculoId: number;
  descricao: string;
  valor: number;
  data: string;
  itens: OrcamentoItem[];
};

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

export type Orcamento = {
  id: number;
  descricao: string;
  valor: number;
  data: string;
  status: "analise" | "aprovado" | "recusado";
  cliente: { id: number; nome: string };
  veiculo: { id: number; modelo: string; placa: string };
  itens?: OrcamentoItem[];
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Orcamento | null;
  onClose: () => void;
  onSubmit: (data: OrcamentoForm) => void;
  onDelete?: (item: Orcamento) => void;
};

function formatPreco(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseFloat(digits) / 100;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parsePreco(formatted: string): number {
  return parseFloat(formatted.replace(/\./g, "").replace(",", ".")) || 0;
}

export default function DialogOrcamento({ open, mode, initial, onClose, onSubmit, onDelete }: Props) {
  const { user } = useAuth();
  const isEdit = mode === "edit";

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
  const [data, setData] = React.useState(new Date().toISOString().split("T")[0]);
  const [itens, setItens] = React.useState<OrcamentoItem[]>([]);
  const [selecaoAberta, setSelecaoAberta] = React.useState<null | "servico" | "peca">(null);
  const [selecionadoItem, setSelecionadoItem] = React.useState<any | null>(null);

  const [itemInput, setItemInput] = React.useState("");
  const [itemOptions, setItemOptions] = React.useState<any[]>([]);
  const [itemLoading, setItemLoading] = React.useState(false);

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!open || !user?.oficina_id) return;
    api.get(`/servicos?oficina_id=${user.oficina_id}`)
      .then((res) => setServicos(res.data ?? []))
      .catch(() => setServicos([]));
  }, [open, user?.oficina_id]);

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

  React.useEffect(() => {
    if (!open) return;
    const cId = Number(initial?.cliente?.id ?? (initial as any)?.cliente_id ?? 0);
    setClienteId(cId);
    setClienteValue(cId ? { id: cId, nome: initial?.cliente?.nome ?? String(cId) } : null);
    setClienteInput("");
    setClienteOptions([]);
    setVeiculoId(initial?.veiculo?.id ?? (initial as any)?.veiculo_id ?? 0);
    setDescricao(initial?.descricao ?? "");
    setPrecoFormatado(
      initial?.valor
        ? Number(initial.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
        : ""
    );
    setData(initial?.data ? initial.data.split("T")[0] : new Date().toISOString().split("T")[0]);
    setItens((initial?.itens ?? []).map((i: any) => ({
      id: i.id,
      tipo_item: i.tipo_item,
      nome: i.nome ?? i.servico?.nome ?? i.peca?.nome ?? "Item",
      servico_id: i.servico_id ?? i.servico?.id ?? null,
      peca_id: i.peca_id ?? i.peca?.id ?? null,
      quantidade: Number(i.quantidade ?? 1),
      preco_unitario: Number(i.preco_unitario ?? 0),
      subtotal: Number(i.subtotal ?? 0),
    })));
    setErrors({});
    setSubmitAttempted(false);
    setConfirmDelete(false);
    setSelecaoAberta(null);
    setSelecionadoItem(null);
    setItemInput("");
    setItemOptions([]);
  }, [open, initial]);

  React.useEffect(() => {
    if (submitAttempted) validate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, veiculoId, descricao, precoFormatado, itens]);

  const totalItens = itens.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0);

  const handleAddItem = () => {
    if (!selecaoAberta || !selecionadoItem) return;
    const exists = itens.some((item) =>
      item.tipo_item === selecaoAberta &&
      (selecaoAberta === "servico" ? item.servico_id : item.peca_id) === selecionadoItem.id
    );
    if (exists) return;
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
    setItens((prev) => prev.map((item) => (
      item.id === id ? { ...item, quantidade: qtd, subtotal: qtd * Number(item.preco_unitario) } : item
    )));
  };

  const handleDeleteItem = (id: string | number) => setItens((prev) => prev.filter((item) => item.id !== id));

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!clienteId) errs.clienteId = "Selecione o cliente";
    if (!veiculoId) errs.veiculoId = "Selecione o veículo";
    if (!descricao.trim()) errs.descricao = "Descreva os serviços do orçamento";
    const preco = totalItens > 0 ? totalItens : parsePreco(precoFormatado);
    if (!preco || preco <= 0) errs.valor = "Informe um valor válido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (!validate()) return;
    onSubmit({
      clienteId, veiculoId,
      descricao: descricao.trim(),
      valor: totalItens > 0 ? totalItens : parsePreco(precoFormatado),
      data, itens,
    });
    onClose();
  };

  const precoNum = totalItens > 0 ? totalItens : parsePreco(precoFormatado);

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      title={isEdit ? "Editar orçamento" : "Novo orçamento"}
      icon={<RequestQuoteRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <Grid container spacing={1.5}>
          <Grid size={12}>
            <SectionLabel>Cliente e veículo</SectionLabel>
          </Grid>

          {/* Cliente */}
          <Grid size={{ xs: 12, md: 6 }}>
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
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonRoundedIcon fontSize="small" color={errors.clienteId ? "error" : "action"} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <>
                        {clienteLoading && <CircularProgress size={16} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          {/* Veículo */}
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              select
              label="Veículo *"
              value={veiculoId}
              onChange={(e) => setVeiculoId(Number(e.target.value))}
              size="small"
              fullWidth
              disabled={!clienteId}
              error={!!errors.veiculoId}
              helperText={errors.veiculoId || (!clienteId ? "Selecione um cliente primeiro" : undefined)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {loadingVeiculos
                      ? <CircularProgress size={14} />
                      : <DirectionsCarRoundedIcon fontSize="small" color={errors.veiculoId ? "error" : "action"} />}
                  </InputAdornment>
                ),
              }}
            >
              {veiculos.length === 0 ? (
                <MenuItem disabled value={0}>
                  {clienteId ? "Nenhum veículo encontrado" : "Selecione o cliente primeiro"}
                </MenuItem>
              ) : (
                veiculos.map((v) => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.modelo}
                    <Box
                      component="span"
                      sx={{
                        ml: 1, px: 0.75, py: 0.1, borderRadius: 0.75,
                        bgcolor: (t) => alpha(t.palette.text.primary, 0.07),
                        fontFamily: "monospace", fontWeight: 700, fontSize: 11,
                      }}
                    >
                      {v.placa}
                    </Box>
                  </MenuItem>
                ))
              )}
            </TextField>
          </Grid>

          {/* Itens */}
          <Grid size={12}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1} alignItems={{ xs: "stretch", sm: "center" }} mb={1}>
              <SectionLabel sx={{ mb: 0 }}>Itens do orçamento</SectionLabel>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  startIcon={<AddRoundedIcon />}
                  variant={selecaoAberta === "servico" ? "contained" : "outlined"}
                  onClick={() => setSelecaoAberta(selecaoAberta === "servico" ? null : "servico")}
                >
                  Mão de obra
                </Button>
                <Button
                  size="small"
                  startIcon={<AddRoundedIcon />}
                  variant={selecaoAberta === "peca" ? "contained" : "outlined"}
                  color="secondary"
                  onClick={() => setSelecaoAberta(selecaoAberta === "peca" ? null : "peca")}
                >
                  Peças
                </Button>
              </Stack>
            </Stack>

            {selecaoAberta && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mb={1.5}>
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
                      label={selecaoAberta === "servico" ? "Selecionar serviço" : "Selecionar peça"}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {itemLoading && <CircularProgress size={16} />}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
                <Button variant="contained" disableElevation onClick={handleAddItem} sx={{ px: 3 }}>
                  Adicionar
                </Button>
              </Stack>
            )}

            <Box sx={{ border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 2, overflow: "hidden", bgcolor: "background.paper" }}>
              {itens.length ? (
                <Stack divider={<Divider />}>
                  {itens.map((item) => (
                    <Stack
                      key={item.id}
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.5}
                      alignItems={{ xs: "stretch", sm: "center" }}
                      sx={{ p: 1.5 }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>{item.nome}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.tipo_item === "servico" ? "Mão de obra" : "Peça"} • R$ {Number(item.preco_unitario).toFixed(2)}
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
                      <Typography variant="body2" fontWeight={800} color="success.main" sx={{ minWidth: 110, textAlign: { xs: "left", sm: "right" } }}>
                        R$ {Number(item.subtotal).toFixed(2)}
                      </Typography>
                      <IconButton color="error" size="small" onClick={() => handleDeleteItem(item.id)}>
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  Adicione serviços e peças para o orçamento.
                </Typography>
              )}
            </Box>
          </Grid>

          {/* Detalhes */}
          <Grid size={12}>
            <SectionLabel>Detalhes do orçamento</SectionLabel>
          </Grid>

          <Grid size={12}>
            <TextField
              label="Descrição dos serviços *"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Troca de óleo + filtro, alinhamento, balanceamento..."
              size="small"
              fullWidth
              multiline
              rows={2}
              error={!!errors.descricao}
              helperText={errors.descricao}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start" sx={{ alignSelf: "flex-start", mt: 1 }}>
                    <DescriptionRoundedIcon fontSize="small" color={errors.descricao ? "error" : "action"} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Valor total *"
              value={totalItens > 0 ? totalItens.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : precoFormatado}
              onChange={(e) => setPrecoFormatado(formatPreco(e.target.value))}
              disabled={totalItens > 0}
              placeholder="0,00"
              size="small"
              fullWidth
              error={!!errors.valor}
              helperText={errors.valor}
              inputProps={{ inputMode: "numeric" }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography variant="body2" color="text.secondary" fontWeight={700}>R$</Typography>
                  </InputAdornment>
                ),
              }}
              sx={{ "& input": { fontWeight: 700, color: (t) => precoNum > 0 ? t.palette.success.main : undefined } }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Data do orçamento"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarTodayRoundedIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
        </Grid>

        <Collapse in={submitAttempted && Object.keys(errors).length > 0}>
          <Alert severity="error" sx={{ mt: 0.5, borderRadius: 2 }}>
            Preencha todos os campos obrigatórios antes de salvar.
          </Alert>
        </Collapse>
      </AppDialogContent>

      <AppDialogActions sx={{ justifyContent: "space-between" }}>
        <Box>
          {isEdit && onDelete && initial && (
            <>
              {!confirmDelete ? (
                <Button
                  color="error"
                  startIcon={<DeleteOutlineRoundedIcon />}
                  onClick={() => setConfirmDelete(true)}
                  sx={{ borderRadius: 999 }}
                >
                  Excluir orçamento
                </Button>
              ) : (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="error" fontWeight={600}>Confirmar exclusão?</Typography>
                  <Button color="error" variant="contained" size="small" disableElevation onClick={() => onDelete(initial)} sx={{ borderRadius: 999 }}>
                    Sim, excluir
                  </Button>
                  <Button size="small" onClick={() => setConfirmDelete(false)} sx={{ borderRadius: 999 }}>Cancelar</Button>
                </Stack>
              )}
            </>
          )}
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 999 }}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit} disableElevation sx={{ borderRadius: 999, fontWeight: 700 }}>
            {isEdit ? "Salvar alterações" : "Criar orçamento"}
          </Button>
        </Stack>
      </AppDialogActions>
    </AppDialog>
  );
}
