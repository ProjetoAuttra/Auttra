import * as React from "react";
import {
  Box,
  Stack, TextField,
  Button, IconButton, Typography, Grid, InputAdornment,
  MenuItem, Chip, Tooltip, Autocomplete,
} from "@mui/material";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import CalendarTodayRoundedIcon from "@mui/icons-material/CalendarTodayRounded";
import LocalGasStationRoundedIcon from "@mui/icons-material/LocalGasStationRounded";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { listarClientes } from "../../../api/client";
import ClientDialog, { type ClientForm } from "../../clientes/dialog";
import api from "../../../api/api";
import { AppDialog, AppDialogActions, AppDialogContent, SectionLabel } from "../../../components/common/AppDialog";

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type Veiculo = {
  id: string;
  cliente_id?: number;
  cliente_nome: string;
  marca: string;
  modelo: string;
  ano?: number;
  placa: string;
  cor?: string;
  combustivel?: string;
  quilometragem?: number;
  observacao?: string;
  criado_em: string;
};

export type VeiculoForm = {
  cliente_id?: number;
  marca: string;
  modelo: string;
  ano?: number | "";
  placa: string;
  cor?: string;
  combustivel?: string;
  quilometragem?: number | "";
  observacao?: string;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Veiculo | null;
  defaultCliente?: { id: number; nome: string } | null;
  onClose: () => void;
  onSubmit: (data: VeiculoForm) => void;
};

// ─── Constantes ────────────────────────────────────────────────────────────

const COMBUSTIVEIS = [
  { value: "gasolina", label: "Gasolina" },
  { value: "etanol", label: "Etanol" },
  { value: "flex", label: "Flex (Gasolina/Etanol)" },
  { value: "diesel", label: "Diesel" },
  { value: "gnv", label: "GNV" },
  { value: "eletrico", label: "Elétrico" },
  { value: "hibrido", label: "Híbrido" },
];

const CORES = [
  "Branco", "Prata", "Preto", "Cinza", "Vermelho",
  "Azul", "Verde", "Amarelo", "Laranja", "Bege", "Marrom", "Vinho",
];

// ─── Utilitários ───────────────────────────────────────────────────────────

function formatPlaca(raw: string): string {
  const c = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 7);
  if (c.length <= 3) return c;
  const letters = c.slice(0, 3);
  const rest = c.slice(3);
  if (rest.length >= 2 && /[A-Z]/.test(rest[1])) return `${letters}${rest}`;
  return `${letters}-${rest}`;
}

function isPlacaValida(placa: string): boolean {
  const c = placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return /^[A-Z]{3}[0-9]{4}$/.test(c) || /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(c);
}

// ─── Componente ────────────────────────────────────────────────────────────

export default function VeiculoDialog({ open, mode, initial, defaultCliente, onClose, onSubmit }: Props) {
  const currentYear = new Date().getFullYear();
  const isEdit = mode === "edit";

  const [clientes, setClientes] = React.useState<{ id: number; nome: string }[]>([]);
  const [clienteId, setClienteId] = React.useState<number>(0);
  const [marca, setMarca] = React.useState("");
  const [modelo, setModelo] = React.useState("");
  const [ano, setAno] = React.useState<number | "">("");
  const [placa, setPlaca] = React.useState("");
  const [cor, setCor] = React.useState("");
  const [combustivel, setCombustivel] = React.useState("");
  const [quilometragem, setQuilometragem] = React.useState<number | "">("");
  const [observacao, setObservacao] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const [openNovoCliente, setOpenNovoCliente] = React.useState(false);

  React.useEffect(() => {
    if (!isEdit) {
      listarClientes().then((data: any) => {
        const mapped = data.map((c: any) => ({ id: Number(c.id), nome: c.nome }));
        if (defaultCliente && !mapped.some((c: { id: number }) => c.id === defaultCliente.id)) {
          mapped.unshift(defaultCliente);
        }
        setClientes(mapped);
      });
    }
  }, [isEdit, defaultCliente]);

  React.useEffect(() => {
    if (!open) return;
    setClienteId(!isEdit ? defaultCliente?.id ?? 0 : 0);
    setMarca(initial?.marca ?? "");
    setModelo(initial?.modelo ?? "");
    setAno(initial?.ano ?? "");
    setPlaca(initial?.placa ?? "");
    setCor(initial?.cor ?? "");
    setCombustivel(initial?.combustivel ?? "");
    setQuilometragem(initial?.quilometragem ?? "");
    setObservacao(initial?.observacao ?? "");
    setErrors({});
    setSubmitAttempted(false);
  }, [open, initial, isEdit, defaultCliente]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!isEdit && !clienteId) errs.clienteId = "Selecione o proprietário";
    if (!marca.trim()) errs.marca = "Informe a marca";
    if (!modelo.trim()) errs.modelo = "Informe o modelo";
    if (!placa.trim()) errs.placa = "Informe a placa";
    else if (!isPlacaValida(placa)) errs.placa = "Placa inválida (ex: ABC-1234 ou ABC1D23)";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  React.useEffect(() => {
    if (submitAttempted) validate();
  }, [clienteId, marca, modelo, placa, submitAttempted]);

  const handleClienteCriado = async (data: ClientForm) => {
    const res = await api.post("/clientes", data);
    const novo = { id: Number(res.data.id), nome: res.data.nome };
    setClientes((prev) => [novo, ...prev]);
    setClienteId(novo.id);
    setOpenNovoCliente(false);
  };

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (!validate()) return;
    onSubmit({
      ...(clienteId ? { cliente_id: clienteId } : {}),
      marca: marca.trim(),
      modelo: modelo.trim(),
      placa: placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      ano: ano === "" ? undefined : Number(ano),
      cor: cor.trim() || undefined,
      combustivel: combustivel || undefined,
      quilometragem: quilometragem === "" ? undefined : Number(quilometragem),
      observacao: observacao.trim() || undefined,
    });
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      onCloseClick={onClose}
      closeOnBackdrop={false}
      closeOnEscape={false}
      maxWidth="sm"
      title={isEdit ? "Editar veículo" : "Novo veículo"}
      icon={<DirectionsCarRoundedIcon />}
      variant="entity"
    >
      {/* ── Body ── */}
      <AppDialogContent>
        <Grid container spacing={1.5}>

          {/* Cliente (só no criar) */}
          {!isEdit && (
            <Grid size={12}>
              <Autocomplete
                fullWidth
                size="small"
                options={clientes}
                getOptionLabel={(o) => o.nome}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={clientes.find((c) => c.id === clienteId) ?? null}
                onChange={(_, v) => setClienteId(v?.id ?? 0)}
                disabled={!!defaultCliente}
                noOptionsText="Nenhum cliente encontrado"
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Cliente proprietário *"
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
                          {params.InputProps.endAdornment}
                          {!defaultCliente && (
                            <InputAdornment position="end">
                              <Tooltip title="Criar novo cliente">
                                <IconButton
                                  size="small"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => { e.stopPropagation(); setOpenNovoCliente(true); }}
                                  sx={{ color: "primary.main", p: 0.25 }}
                                >
                                  <AddRoundedIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>
                            </InputAdornment>
                          )}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>
          )}

          {/* Marca + Modelo */}
          <Grid size={6}>
            <TextField
              fullWidth size="small" label="Marca *"
              value={marca} onChange={(e) => setMarca(e.target.value)}
              error={!!errors.marca} helperText={errors.marca}
            />
          </Grid>
          <Grid size={6}>
            <TextField
              fullWidth size="small" label="Modelo *"
              value={modelo} onChange={(e) => setModelo(e.target.value)}
              error={!!errors.modelo} helperText={errors.modelo}
            />
          </Grid>

          {/* Placa + Ano */}
          <Grid size={5}>
            <TextField
              fullWidth size="small" label="Placa *"
              value={placa}
              onChange={(e) => setPlaca(formatPlaca(e.target.value))}
              error={!!errors.placa} helperText={errors.placa}
              inputProps={{
                maxLength: 8,
                style: { fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" },
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <CreditCardRoundedIcon fontSize="small" color={errors.placa ? "error" : "action"} />
                    </InputAdornment>
                  ),
                  endAdornment: isPlacaValida(placa) ? (
                    <InputAdornment position="end">
                      <CheckCircleOutlineRoundedIcon fontSize="small" color="success" />
                    </InputAdornment>
                  ) : undefined,
                },
              }}
            />
          </Grid>
          <Grid size={3}>
            <TextField
              fullWidth size="small" label="Ano" type="number"
              value={ano}
              onChange={(e) => setAno(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
              inputProps={{ min: 1900, max: currentYear + 1 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarTodayRoundedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Grid>

          <Grid size={12}>
            <SectionLabel>Dados adicionais</SectionLabel>
          </Grid>

          {/* Cor + chips */}
          <Grid size={12}>
            <TextField
              fullWidth size="small" label="Cor"
              value={cor} onChange={(e) => setCor(e.target.value)}
            />
            <Stack direction="row" flexWrap="wrap" gap={0.5} mt={0.5}>
              {CORES.map((c) => (
                <Chip
                  key={c} label={c} size="small"
                  variant={cor === c ? "filled" : "outlined"}
                  color={cor === c ? "primary" : "default"}
                  onClick={() => setCor(cor === c ? "" : c)}
                  sx={{ fontSize: 10, height: 20, cursor: "pointer" }}
                />
              ))}
            </Stack>
          </Grid>

          {/* Combustível + Quilometragem */}
          <Grid size={6}>
            <TextField
              select fullWidth size="small" label="Combustível"
              value={combustivel} onChange={(e) => setCombustivel(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocalGasStationRoundedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            >
              <MenuItem value=""><em>Não informado</em></MenuItem>
              {COMBUSTIVEIS.map((c) => (
                <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={6}>
            <TextField
              fullWidth size="small" label="Quilometragem" type="number"
              value={quilometragem}
              onChange={(e) => setQuilometragem(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SpeedRoundedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Typography variant="caption" color="text.disabled">km</Typography>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Grid>

          {/* Observações */}
          <Grid size={12}>
            <TextField
              fullWidth size="small" label="Observações"
              value={observacao} onChange={(e) => setObservacao(e.target.value)}
              multiline rows={2}
            />
          </Grid>
        </Grid>
      </AppDialogContent>

      {/* ── Footer ── */}
      <AppDialogActions>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{ borderRadius: 999 }}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disableElevation
          sx={{ borderRadius: 999, fontWeight: 700 }}
        >
          {isEdit ? "Salvar alterações" : "Cadastrar veículo"}
        </Button>
      </AppDialogActions>

      {/* ── Dialog: criar cliente rápido ── */}
      <ClientDialog
        open={openNovoCliente}
        mode="create"
        onClose={() => setOpenNovoCliente(false)}
        onSubmit={handleClienteCriado}
      />
    </AppDialog>
  );
}
