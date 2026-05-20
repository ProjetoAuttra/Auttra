import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
  Button,
  IconButton,
  Typography,
  Paper,
  Grid,
  Box,
  MenuItem,
  InputAdornment,
  alpha,
  Tooltip,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
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
import { HeaderIcon, SectionLabel, PrecoDisplay } from "../../../components/styled/DialogStyles";

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

export default function OrdemServicoDialog({
  open,
  mode = "create",
  initial,
  onClose,
  onSubmit,
}: Props) {
  const { user } = useAuth();
  const isEdit = mode === "edit";

  const [clientes, setClientes] = React.useState<any[]>([]);
  const [veiculos, setVeiculos] = React.useState<any[]>([]);
  const [funcionarios, setFuncionarios] = React.useState<any[]>([]);
  const [servicos, setServicos] = React.useState<any[]>([]);
  const [pecas, setPecas] = React.useState<any[]>([]);

  const [clienteId, setClienteId] = React.useState(0);
  const [veiculoId, setVeiculoId] = React.useState(0);
  const [funcionarioId, setFuncionarioId] = React.useState(0);
  const [observacoes, setObservacoes] = React.useState("");
  const [itens, setItens] = React.useState<Item[]>([]);
  const [selecaoAberta, setSelecaoAberta] = React.useState<null | "servico" | "peca">(null);
  const [selecionadoId, setSelecionadoId] = React.useState<number>(0);

  React.useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const params = { oficina_id: user?.oficina_id };
        const [cli, vei, func, serv, pec] = await Promise.all([
          api.get("/clientes", { params }),
          api.get("/veiculos", { params }),
          api.get("/funcionarios", { params }),
          api.get("/servicos", { params }),
          api.get("/pecas", { params }),
        ]);
        setClientes(cli.data);
        setVeiculos(vei.data);
        setFuncionarios(func.data);
        setServicos(serv.data);
        setPecas(pec.data);

        if (initial) {
          setClienteId(Number(initial.cliente_id ?? initial.cliente?.id ?? 0));
          setVeiculoId(Number(initial.veiculo_id ?? initial.veiculo?.id ?? 0));
          setFuncionarioId(Number(initial.funcionario_id ?? initial.funcionario?.id ?? 0));
          setObservacoes(initial.observacoes || "");
          setItens((initial.itens ?? []).map((i: any) => ({
            id: String(i.id),
            tipo_item: i.tipo_item,
            nome: i.nome ?? i.servico?.nome ?? i.peca?.nome ?? "—",
            servico_id: i.servico_id ?? i.servico?.id ?? null,
            peca_id: i.peca_id ?? i.peca?.id ?? null,
            preco_unitario: Number(i.preco_unitario),
            quantidade: Number(i.quantidade),
            subtotal: Number(i.subtotal),
          })));
        } else {
          setClienteId(0);
          setVeiculoId(0);
          setFuncionarioId(0);
          setObservacoes("");
          setItens([]);
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      }
    })();
  }, [open, initial, isEdit, user?.oficina_id]);

  const handleAddItem = () => {
    const lista = selecaoAberta === "servico" ? servicos : pecas;
    const selecionado = lista.find((x) => x.id === selecionadoId);
    if (!selecionado) return;
    
    if (itens.some((i) => i.tipo_item === selecaoAberta && i.nome === selecionado.nome)) {
      return;
    }

    const preco = Number(selecionado.preco_venda ?? selecionado.preco ?? 0);
    const id_campo = selecaoAberta === "servico" ? "servico_id" : "peca_id";
    setItens((p) => [
      ...p,
      {
        id: String(Date.now()),
        tipo_item: selecaoAberta!,
        nome: selecionado.nome,
        [id_campo]: selecionado.id,
        preco_unitario: preco,
        quantidade: 1,
        subtotal: preco,
      },
    ]);
    setSelecaoAberta(null);
    setSelecionadoId(0);
  };

  const handleQtdChange = (id: string, qtd: number) =>
    setItens((p) =>
      p.map((x) => (x.id === id ? { ...x, quantidade: qtd, subtotal: qtd * x.preco_unitario } : x))
    );

  const handleDeleteItem = (id: string) => setItens((p) => p.filter((x) => x.id !== id));
  const total = itens.reduce((sum, i) => sum + i.subtotal, 0);

  const handleSubmit = async () => {
    if (!clienteId || !veiculoId || !funcionarioId) return;
    
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
    
    onSubmit(payload);
  };

  const columns: GridColDef[] = [
    { 
      field: "tipo_item", 
      headerName: "Tipo", 
      width: 100,
      renderCell: (params) => (
        <Typography variant="caption" sx={{ textTransform: "uppercase", fontWeight: 700, color: params.value === "servico" ? "primary.main" : "secondary.main" }}>
          {params.value}
        </Typography>
      )
    },
    { field: "nome", headerName: "Item / Descrição", flex: 1 },
    {
      field: "quantidade",
      headerName: "Qtd",
      width: 100,
      renderCell: (params) => (
        <TextField
          type="number"
          size="small"
          value={params.row.quantidade}
          onChange={(e) => handleQtdChange(params.row.id, Number(e.target.value))}
          inputProps={{ min: 1 }}
          sx={{ width: 70, "& .MuiInputBase-root": { height: 32 } }}
        />
      ),
    },
    { 
      field: "preco_unitario", 
      headerName: "Unitário", 
      width: 120,
      valueFormatter: (value: number) => `R$ ${value.toFixed(2)}`
    },
    { 
      field: "subtotal", 
      headerName: "Subtotal", 
      width: 120,
      valueFormatter: (value: number) => `R$ ${value.toFixed(2)}`,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight={700}>R$ {params.value.toFixed(2)}</Typography>
      )
    },
    {
      field: "actions",
      headerName: "",
      width: 50,
      sortable: false,
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
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="lg"
      PaperProps={{
        sx: { borderRadius: 3, overflow: "hidden" }
      }}
    >
      <Paper
        elevation={0}
        square
        sx={{
          px: 3.5,
          py: 2.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.1)} 0%, ${alpha(t.palette.primary.light, 0.04)} 100%)`,
          borderBottom: (t) => `1px solid ${alpha(t.palette.primary.main, 0.1)}`,
        }}
      >
        <Stack direction="row" spacing={1.75} alignItems="center">
          <HeaderIcon>
            <AssignmentRoundedIcon />
          </HeaderIcon>
          <Stack spacing={0.25}>
            <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
              {isEdit ? "Editar Ordem de Serviço" : "Nova Ordem de Serviço"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Controle de serviços, peças e mão de obra
            </Typography>
          </Stack>
        </Stack>
        <IconButton onClick={onClose} size="small">
          <CloseRoundedIcon />
        </IconButton>
      </Paper>

      <DialogContent sx={{ px: { xs: 3, md: 4 }, pt: 4, pb: 2, bgcolor: (t) => alpha(t.palette.background.default, 0.5) }}>
        <Grid container spacing={4}>
          {/* INFORMAÇÕES BÁSICAS */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={3}>
              <Box>
                <SectionLabel><PersonRoundedIcon sx={{ fontSize: 12, mr: 0.5 }} /> Cliente / Proprietário</SectionLabel>
                <TextField 
                  select 
                  label="Selecionar Cliente" 
                  value={clienteId} 
                  onChange={(e) => setClienteId(Number(e.target.value))} 
                  fullWidth 
                  size="small"
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><PersonRoundedIcon fontSize="small" /></InputAdornment>
                  }}
                >
                  <MenuItem value={0} disabled>Selecione o cliente</MenuItem>
                  {clientes.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.nome}</MenuItem>
                  ))}
                </TextField>
              </Box>

              <Box>
                <SectionLabel><DirectionsCarRoundedIcon sx={{ fontSize: 12, mr: 0.5 }} /> Veículo</SectionLabel>
                <TextField 
                  select 
                  label="Selecionar Veículo" 
                  value={veiculoId} 
                  onChange={(e) => setVeiculoId(Number(e.target.value))} 
                  fullWidth 
                  size="small"
                  disabled={!clienteId}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><DirectionsCarRoundedIcon fontSize="small" /></InputAdornment>
                  }}
                >
                  <MenuItem value={0} disabled>Selecione o veículo</MenuItem>
                  {veiculos.filter((v) => !clienteId || v.cliente_id === clienteId).map((v) => (
                    <MenuItem key={v.id} value={v.id}>{v.modelo} — {v.placa}</MenuItem>
                  ))}
                </TextField>
              </Box>

              <Box>
                <SectionLabel><EngineeringRoundedIcon sx={{ fontSize: 12, mr: 0.5 }} /> Responsável / Mecânico</SectionLabel>
                <TextField 
                  select 
                  label="Selecionar Mecânico" 
                  value={funcionarioId} 
                  onChange={(e) => setFuncionarioId(Number(e.target.value))} 
                  fullWidth 
                  size="small"
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><EngineeringRoundedIcon fontSize="small" /></InputAdornment>
                  }}
                >
                  <MenuItem value={0} disabled>Selecione o funcionário</MenuItem>
                  {funcionarios.map((f) => (
                    <MenuItem key={f.id} value={f.id}>{f.nome}</MenuItem>
                  ))}
                </TextField>
              </Box>
            </Stack>
          </Grid>

          {/* ITENS E SERVIÇOS */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Box sx={{ bgcolor: "background.paper", borderRadius: 2, border: "1px solid #E0E4EC", overflow: "hidden" }}>
              <Box sx={{ p: 2, borderBottom: "1px solid #F0F0F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <SectionLabel sx={{ mb: 0 }}>Itens da Ordem de Serviço</SectionLabel>
                <Stack direction="row" spacing={1}>
                  <Button 
                    size="small" 
                    startIcon={<AddRoundedIcon />} 
                    variant={selecaoAberta === "servico" ? "contained" : "outlined"}
                    onClick={() => setSelecaoAberta(selecaoAberta === "servico" ? null : "servico")}
                  >
                    Mão de Obra
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
              </Box>

              {selecaoAberta && (
                <Box sx={{ p: 2, bgcolor: alpha("#f0f0f0", 0.5), borderBottom: "1px solid #F0F0F0" }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <TextField 
                      select 
                      label={selecaoAberta === "servico" ? "Pesquisar Serviço" : "Pesquisar Peça"} 
                      value={selecionadoId} 
                      onChange={(e) => setSelecionadoId(Number(e.target.value))} 
                      size="small" 
                      fullWidth
                    >
                      <MenuItem value={0} disabled>{selecaoAberta === "servico" ? "Escolha um serviço" : "Escolha uma peça"}</MenuItem>
                      {(selecaoAberta === "servico" ? servicos : pecas).map((i) => (
                        <MenuItem key={i.id} value={i.id}>{i.nome} — R$ {Number(i.preco_venda ?? i.preco ?? 0).toFixed(2)}</MenuItem>
                      ))}
                    </TextField>
                    <Button variant="contained" disableElevation onClick={handleAddItem} sx={{ px: 3 }}>Adicionar</Button>
                  </Stack>
                </Box>
              )}

              <Box sx={{ height: 320 }}>
                <DataGrid 
                  rows={itens} 
                  columns={columns} 
                  hideFooter 
                  disableRowSelectionOnClick 
                  getRowId={(row) => row.id} 
                  sx={{ 
                    border: "none",
                    "& .MuiDataGrid-columnHeaders": { bgcolor: alpha("#000", 0.02) },
                    "& .MuiDataGrid-cell:focus": { outline: "none" }
                  }}
                />
              </Box>

              <Box sx={{ p: 2, borderTop: "1px solid #F0F0F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="body2" color="text.secondary">Total de {itens.length} itens inclusos</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle2" fontWeight={700}>TOTAL:</Typography>
                  <PrecoDisplay>
                    <Typography variant="caption" fontWeight={800} color="success.main" sx={{ mt: 0.5 }}>R$</Typography>
                    <Typography variant="h6" fontWeight={900} color="success.main">{total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</Typography>
                  </PrecoDisplay>
                </Stack>
              </Box>
            </Box>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <SectionLabel><NotesRoundedIcon sx={{ fontSize: 12, mr: 0.5 }} /> Observações / Check-list de Entrada</SectionLabel>
            <TextField 
              placeholder="Detalhe o estado do veículo, solicitações específicas do cliente ou qualquer observação relevante..." 
              value={observacoes} 
              onChange={(e) => setObservacoes(e.target.value)} 
              fullWidth 
              multiline 
              rows={3}
              sx={{ bgcolor: "background.paper", borderRadius: 1 }}
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 4, py: 3, borderTop: "1px solid #F0F0F0", justifyContent: "flex-end", spacing: 2 }}>
        <Button onClick={onClose} sx={{ borderRadius: 999, textTransform: "none", fontWeight: 600, color: "text.secondary" }}>Cancelar</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disableElevation
          sx={{ 
            borderRadius: 999, 
            px: 5, 
            textTransform: "none", 
            fontWeight: 800,
            background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.primary.dark})`
          }}
        >
          {isEdit ? "Salvar Alterações" : "Gerar Ordem de Serviço"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
