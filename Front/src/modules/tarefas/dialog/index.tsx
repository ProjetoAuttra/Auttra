import * as React from "react";
import {
  Stack,
  TextField,
  Button,
  IconButton,
  Typography,
  Grid,
  Box,
  MenuItem,
  InputAdornment,
  alpha,
  Tooltip,
  Autocomplete,
  CircularProgress,
} from "@mui/material";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import EngineeringRoundedIcon from "@mui/icons-material/EngineeringRounded";
import NotesRoundedIcon from "@mui/icons-material/NotesRounded";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid/models/colDef";
import api from "../../../api/api";
import { useAuth } from "../../../context/AuthContext";
import { SectionLabel, PrecoDisplay } from "../../../components/styled/DialogStyles";
import { AppDialog, AppDialogActions, AppDialogContent } from "../../../components/common/AppDialog";

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

type Props = {
  open: boolean;
  mode?: "create" | "edit";
  initial?: any;
  onClose: () => void;
  onSubmit: (data: any) => void;
};

type Opcao = { id: number; nome: string };

export default function OrdemServicoDialog({ open, mode = "create", initial, onClose, onSubmit }: Props) {
  const { user } = useAuth();
  const isEdit = mode === "edit";

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

  React.useEffect(() => {
    if (!open) return;
    const params = { oficina_id: user?.oficina_id };
    Promise.all([
      api.get("/funcionarios", { params }),
      api.get("/servicos", { params }),
    ])
      .then(([func, serv]) => {
        setFuncionarios(func.data.map((f: any) => ({ id: Number(f.id), nome: f.nome })));
        setServicos(serv.data);
      })
      .catch((err) => console.error("Erro ao carregar listas:", err));
  }, [open, user?.oficina_id]);

  React.useEffect(() => {
    if (!clienteId) { setVeiculos([]); setVeiculoId(0); return; }
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
  }, [funcionarios, funcionarioId]);

  React.useEffect(() => {
    if (!open) return;
    const cId = Number(initial?.cliente_id ?? initial?.cliente?.id ?? 0);
    const vId = Number(initial?.veiculo_id ?? initial?.veiculo?.id ?? 0);
    const fId = Number(initial?.funcionario_id ?? initial?.funcionario?.id ?? 0);
    setClienteId(cId);
    setClienteValue(cId ? { id: cId, nome: initial?.cliente?.nome ?? String(cId) } : null);
    setClienteInput("");
    setClienteOptions([]);
    setVeiculoId(vId);
    setFuncionarioId(fId);
    setFuncionarioValue(null);
    setObservacoes(initial?.observacoes || "");
    setSelecaoAberta(null);
    setSelecionadoItem(null);
    setItemInput("");
    setItemOptions([]);
    setItens(
      (initial?.itens ?? []).map((i: any) => ({
        id: String(i.id),
        tipo_item: i.tipo_item,
        nome: i.nome ?? i.servico?.nome ?? i.peca?.nome ?? "—",
        servico_id: i.servico_id ?? i.servico?.id ?? null,
        peca_id: i.peca_id ?? i.peca?.id ?? null,
        preco_unitario: Number(i.preco_unitario),
        quantidade: Number(i.quantidade),
        subtotal: Number(i.subtotal),
      }))
    );
  }, [open, initial]);

  const abrirSelecao = (tipo: "servico" | "peca") => {
    const next = selecaoAberta === tipo ? null : tipo;
    setSelecaoAberta(next);
    setSelecionadoItem(null);
    setItemInput("");
    setItemOptions([]);
  };

  const handleAddItem = () => {
    if (!selecionadoItem || !selecaoAberta) return;
    if (itens.some((i) => i.tipo_item === selecaoAberta && i.nome === selecionadoItem.nome)) return;
    const preco = Number(selecionadoItem.preco_venda ?? selecionadoItem.preco ?? 0);
    const id_campo = selecaoAberta === "servico" ? "servico_id" : "peca_id";
    setItens((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        tipo_item: selecaoAberta,
        nome: selecionadoItem.nome,
        [id_campo]: selecionadoItem.id,
        preco_unitario: preco,
        quantidade: 1,
        subtotal: preco,
      },
    ]);
    setSelecionadoItem(null);
    setItemInput("");
    setItemOptions([]);
    setSelecaoAberta(null);
  };

  const handleQtdChange = (id: string, qtd: number) =>
    setItens((p) => p.map((x) => (x.id === id ? { ...x, quantidade: qtd, subtotal: qtd * x.preco_unitario } : x)));

  const handleDeleteItem = (id: string) => setItens((p) => p.filter((x) => x.id !== id));
  const total = itens.reduce((sum, i) => sum + i.subtotal, 0);

  const handleSubmit = async () => {
    if (!clienteId || !veiculoId || !funcionarioId) return;
    onSubmit({
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
    });
  };

  const columns: GridColDef[] = [
    {
      field: "tipo_item", headerName: "Tipo", width: 100,
      renderCell: (params) => (
        <Typography variant="caption" sx={{ textTransform: "uppercase", fontWeight: 700, color: params.value === "servico" ? "primary.main" : "secondary.main" }}>
          {params.value}
        </Typography>
      ),
    },
    { field: "nome", headerName: "Item / Descrição", flex: 1 },
    {
      field: "quantidade", headerName: "Qtd", width: 100,
      renderCell: (params) => (
        <TextField
          type="number" size="small" value={params.row.quantidade}
          onChange={(e) => handleQtdChange(params.row.id, Number(e.target.value))}
          inputProps={{ min: 1 }}
          sx={{ width: 70, "& .MuiInputBase-root": { height: 32 } }}
        />
      ),
    },
    { field: "preco_unitario", headerName: "Unitário", width: 120, valueFormatter: (value: number) => `R$ ${value.toFixed(2)}` },
    {
      field: "subtotal", headerName: "Subtotal", width: 120,
      valueFormatter: (value: number) => `R$ ${value.toFixed(2)}`,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight={700}>R$ {params.value.toFixed(2)}</Typography>
      ),
    },
    {
      field: "actions", headerName: "", width: 50, sortable: false,
      renderCell: (params) => (
        <Tooltip title="Remover">
          <IconButton size="small" color="error" onClick={() => handleDeleteItem(params.row.id)}>
            <DeleteRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      onCloseClick={onClose}
      closeOnBackdrop={false}
      closeOnEscape={false}
      maxWidth="lg"
      title={isEdit ? "Editar Ordem de Serviço" : "Nova Ordem de Serviço"}
      icon={<AssignmentRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <Grid container spacing={3}>
          {/* INFORMAÇÕES BÁSICAS */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={2.5}>
              <Box>
                <SectionLabel>
                  <PersonRoundedIcon sx={{ fontSize: 12, mr: 0.5 }} /> Cliente / Proprietário
                </SectionLabel>
                <Autocomplete
                  fullWidth size="small"
                  options={clienteOptions}
                  getOptionLabel={(o) => o.nome}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  value={clienteValue}
                  onChange={(_, v) => { setClienteValue(v); setClienteId(v?.id ?? 0); if (!v) { setVeiculoId(0); setVeiculos([]); } }}
                  inputValue={clienteInput}
                  onInputChange={(_, v) => setClienteInput(v)}
                  filterOptions={(x) => x}
                  loading={clienteLoading}
                  noOptionsText={clienteInput.trim().length < 2 ? "Digite 2+ letras para buscar" : "Nenhum cliente encontrado"}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Selecionar Cliente"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: <InputAdornment position="start"><PersonRoundedIcon fontSize="small" /></InputAdornment>,
                        endAdornment: (<>{clienteLoading && <CircularProgress size={16} />}{params.InputProps.endAdornment}</>),
                      }}
                    />
                  )}
                />
              </Box>

              <Box>
                <SectionLabel>
                  <DirectionsCarRoundedIcon sx={{ fontSize: 12, mr: 0.5 }} /> Veículo
                </SectionLabel>
                <TextField
                  select label="Selecionar Veículo" value={veiculoId}
                  onChange={(e) => setVeiculoId(Number(e.target.value))}
                  fullWidth size="small" disabled={!clienteId}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        {veiculoLoading ? <CircularProgress size={14} /> : <DirectionsCarRoundedIcon fontSize="small" />}
                      </InputAdornment>
                    ),
                  }}
                >
                  <MenuItem value={0} disabled>
                    {clienteId ? "Selecione o veículo" : "Selecione o cliente primeiro"}
                  </MenuItem>
                  {veiculos.map((v) => (
                    <MenuItem key={v.id} value={v.id}>{v.modelo} — {v.placa}</MenuItem>
                  ))}
                </TextField>
              </Box>

              <Box>
                <SectionLabel>
                  <EngineeringRoundedIcon sx={{ fontSize: 12, mr: 0.5 }} /> Responsável / Mecânico
                </SectionLabel>
                <Autocomplete
                  fullWidth size="small"
                  options={funcionarios}
                  getOptionLabel={(o) => o.nome}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  value={funcionarioValue}
                  onChange={(_, v) => { setFuncionarioValue(v); setFuncionarioId(v?.id ?? 0); }}
                  noOptionsText="Nenhum funcionário encontrado"
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Selecionar Mecânico"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: <InputAdornment position="start"><EngineeringRoundedIcon fontSize="small" /></InputAdornment>,
                      }}
                    />
                  )}
                />
              </Box>
            </Stack>
          </Grid>

          {/* ITENS E SERVIÇOS */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Box sx={{ bgcolor: "background.paper", borderRadius: 2, border: "1px solid #E0E4EC", overflow: "hidden" }}>
              <Box sx={{ p: 2, borderBottom: "1px solid #F0F0F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <SectionLabel sx={{ mb: 0 }}>Itens da Ordem de Serviço</SectionLabel>
                <Stack direction="row" spacing={1}>
                  <Button size="small" startIcon={<AddRoundedIcon />} variant={selecaoAberta === "servico" ? "contained" : "outlined"} onClick={() => abrirSelecao("servico")}>
                    Mão de Obra
                  </Button>
                  <Button size="small" startIcon={<AddRoundedIcon />} variant={selecaoAberta === "peca" ? "contained" : "outlined"} color="secondary" onClick={() => abrirSelecao("peca")}>
                    Peças
                  </Button>
                </Stack>
              </Box>

              {selecaoAberta && (
                <Box sx={{ p: 2, bgcolor: alpha("#f0f0f0", 0.5), borderBottom: "1px solid #F0F0F0" }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
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
                          label={selecaoAberta === "servico" ? "Pesquisar Serviço" : "Pesquisar Peça"}
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (<>{itemLoading && <CircularProgress size={16} />}{params.InputProps.endAdornment}</>),
                          }}
                        />
                      )}
                    />
                    <Button variant="contained" disableElevation onClick={handleAddItem} sx={{ px: 3, whiteSpace: "nowrap" }}>
                      Adicionar
                    </Button>
                  </Stack>
                </Box>
              )}

              <Box sx={{ height: 320 }}>
                <DataGrid
                  rows={itens} columns={columns} hideFooter disableRowSelectionOnClick
                  getRowId={(row) => row.id}
                  sx={{
                    border: "none",
                    "& .MuiDataGrid-columnHeaders": { bgcolor: alpha("#000", 0.02) },
                    "& .MuiDataGrid-cell:focus": { outline: "none" },
                  }}
                />
              </Box>

              <Box sx={{ p: 2, borderTop: "1px solid #F0F0F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  Total de {itens.length} itens inclusos
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle2" fontWeight={700}>TOTAL:</Typography>
                  <PrecoDisplay>
                    <Typography variant="caption" fontWeight={800} color="success.main" sx={{ mt: 0.5 }}>R$</Typography>
                    <Typography variant="h6" fontWeight={900} color="success.main">
                      {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </Typography>
                  </PrecoDisplay>
                </Stack>
              </Box>
            </Box>
          </Grid>

          <Grid size={12}>
            <SectionLabel>
              <NotesRoundedIcon sx={{ fontSize: 12, mr: 0.5 }} /> Observações / Check-list de Entrada
            </SectionLabel>
            <TextField
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              fullWidth multiline rows={2}
              size="small"
              sx={{ bgcolor: "background.paper", borderRadius: 1 }}
            />
          </Grid>
        </Grid>
      </AppDialogContent>

      <AppDialogActions>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 999 }}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disableElevation
          disabled={!clienteId || !veiculoId || !funcionarioId}
          sx={{ borderRadius: 999, px: 5, fontWeight: 800 }}
        >
          {isEdit ? "Salvar Alterações" : "Gerar Ordem de Serviço"}
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}
