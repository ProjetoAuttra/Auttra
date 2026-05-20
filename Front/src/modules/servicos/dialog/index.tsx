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
  InputAdornment,
  MenuItem,
  Divider,
  Collapse,
  Alert,
  Box,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  alpha,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ToggleOffRoundedIcon from "@mui/icons-material/ToggleOffRounded";
import ToggleOnRoundedIcon from "@mui/icons-material/ToggleOnRounded";
import { HeaderIcon, PrecoDisplay } from "../../../components/styled/DialogStyles";

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type Servico = {
  id: number;
  nome: string;
  descricao?: string;
  preco: number;
  categoria?: string;
  tempo_estimado?: number; // em minutos
  ativo?: boolean;
  created_at: string;
};

export type ServicoForm = {
  nome: string;
  descricao?: string;
  preco: number;
  categoria?: string;
  tempo_estimado?: number | "";
  ativo: boolean;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Servico | null;
  onClose: () => void;
  onSubmit: (data: ServicoForm) => void;
  onDelete?: (item: Servico) => void;
};

// ─── Constantes ────────────────────────────────────────────────────────────

export const CATEGORIAS = [
  { value: "revisao", label: "Revisão" },
  { value: "freios", label: "Freios" },
  { value: "suspensao", label: "Suspensão" },
  { value: "motor", label: "Motor" },
  { value: "eletrica", label: "Elétrica" },
  { value: "ar_condicionado", label: "Ar-condicionado" },
  { value: "cambio", label: "Câmbio" },
  { value: "funilaria", label: "Funilaria e Pintura" },
  { value: "pneus", label: "Pneus e Rodas" },
  { value: "diagnostico", label: "Diagnóstico" },
  { value: "outros", label: "Outros" },
];

const TEMPOS_RAPIDOS = [
  { label: "30 min", value: 30 },
  { label: "1h", value: 60 },
  { label: "2h", value: 120 },
  { label: "4h", value: 240 },
  { label: "8h", value: 480 },
];

function formatPreco(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseFloat(digits) / 100;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parsePreco(formatted: string): number {
  return parseFloat(formatted.replace(/\./g, "").replace(",", ".")) || 0;
}

function formatTempo(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ─── Componente principal ──────────────────────────────────────────────────

export default function ServicoDialog({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
  onDelete,
}: Props) {
  const isEdit = mode === "edit";

  const [nome, setNome] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [precoFormatado, setPrecoFormatado] = React.useState("");
  const [categoria, setCategoria] = React.useState("");
  const [tempoEstimado, setTempoEstimado] = React.useState<number | "">("");
  const [ativo, setAtivo] = React.useState(true);

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setNome(initial?.nome ?? "");
    setDescricao(initial?.descricao ?? "");
    const valorInicial = initial?.preco ?? 0;
    setPrecoFormatado(
      valorInicial > 0
        ? valorInicial.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
        : ""
    );
    setCategoria(initial?.categoria ?? "");
    setTempoEstimado(initial?.tempo_estimado ?? "");
    setAtivo(initial?.ativo !== false);
    setErrors({});
    setSubmitAttempted(false);
    setConfirmDelete(false);
  }, [open, initial]);

  React.useEffect(() => {
    if (submitAttempted) validate();
  }, [nome, precoFormatado, submitAttempted]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!nome.trim()) errs.nome = "Informe o nome do serviço";
    const preco = parsePreco(precoFormatado);
    if (isNaN(preco) || preco <= 0) errs.preco = "Informe um preço válido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePrecoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPrecoFormatado(formatPreco(e.target.value));
  };

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (!validate()) return;
    onSubmit({
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
      preco: parsePreco(precoFormatado),
      categoria: categoria || undefined,
      tempo_estimado: tempoEstimado === "" ? undefined : Number(tempoEstimado),
      ativo,
    });
    onClose();
  };

  const precoNum = parsePreco(precoFormatado);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: "hidden",
          boxShadow: (t) => `0 24px 60px ${alpha(t.palette.common.black, 0.18)}`,
        },
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
          background: (t) =>
            `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.1)} 0%, ${alpha(
              t.palette.primary.light,
              0.04
            )} 100%)`,
          borderBottom: (t) => `1px solid ${alpha(t.palette.primary.main, 0.1)}`,
        }}
      >
        <Stack direction="row" spacing={1.75} alignItems="center">
          <HeaderIcon>
            <BuildRoundedIcon />
          </HeaderIcon>
          <Stack spacing={0.25}>
            <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
              {isEdit ? "Editar serviço" : "Novo serviço"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isEdit ? "Atualize as informações" : "Preencha os dados do serviço"}
            </Typography>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center">
          {precoNum > 0 && (
            <PrecoDisplay>
              <Typography variant="caption" color="success.main" fontWeight={600} lineHeight={1}>R$</Typography>
              <Typography variant="subtitle1" color="success.main" fontWeight={800} lineHeight={1}>{precoFormatado}</Typography>
            </PrecoDisplay>
          )}
          <IconButton onClick={onClose} size="small">
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Paper>

      <DialogContent
        sx={{
          px: { xs: 3, sm: 4 },
          pt: 3,
          pb: 2,
          bgcolor: (t) => alpha(t.palette.background.default, 0.4),
        }}
      >
        <Grid container spacing={3}>
          <Grid size={12}>
            <Grid container spacing={2}>
              <Grid size={12}>
                <TextField
                  label="Nome do serviço *"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Troca de óleo, Alinhamento, Revisão 10.000km..."
                  size="small"
                  fullWidth
                  autoFocus
                  error={!!errors.nome}
                  helperText={errors.nome || " "}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <BuildRoundedIcon fontSize="small" color={errors.nome ? "error" : "action"} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Categoria"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  size="small"
                  fullWidth
                  helperText=" "
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CategoryRoundedIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                >
                  <MenuItem value=""><em>Sem categoria</em></MenuItem>
                  {CATEGORIAS.map((c) => (
                    <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Preço *"
                  value={precoFormatado}
                  onChange={handlePrecoChange}
                  placeholder="0,00"
                  size="small"
                  fullWidth
                  error={!!errors.preco}
                  helperText={errors.preco || " "}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Typography variant="body2" color="text.secondary" fontWeight={600}>R$</Typography>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ "& input": { fontWeight: 700, color: (t) => precoNum > 0 ? t.palette.success.main : undefined } }}
                />
              </Grid>

              <Grid size={12}>
                <TextField
                  label="Descrição"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  size="small"
                  fullWidth
                  multiline
                  rows={2}
                  helperText=" "
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ alignSelf: "flex-start", mt: 1 }}>
                        <DescriptionRoundedIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>
          </Grid>

          <Grid size={12}>
            <Divider>
              <Typography variant="caption" color="text.disabled" fontWeight={600} letterSpacing={0.5} sx={{ textTransform: "uppercase" }}>
                Detalhes operacionais
              </Typography>
            </Divider>
            <Grid container spacing={2} alignItems="flex-start" sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Tempo estimado"
                  type="number"
                  value={tempoEstimado}
                  onChange={(e) => setTempoEstimado(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                  size="small"
                  fullWidth
                  helperText={tempoEstimado ? `≈ ${formatTempo(Number(tempoEstimado))}` : " "}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <AccessTimeRoundedIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: <InputAdornment position="end"><Typography variant="caption" color="text.disabled">min</Typography></InputAdornment>,
                  }}
                />
                <Stack direction="row" flexWrap="wrap" gap={0.5} mt={-0.5}>
                  {TEMPOS_RAPIDOS.map((t) => (
                    <Chip key={t.value} label={t.label} size="small" variant={tempoEstimado === t.value ? "filled" : "outlined"} color={tempoEstimado === t.value ? "primary" : "default"} onClick={() => setTempoEstimado(tempoEstimado === t.value ? "" : t.value)} sx={{ fontSize: 10, height: 20, cursor: "pointer" }} />
                  ))}
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={1}>Disponibilidade</Typography>
                <ToggleButtonGroup
                  value={ativo ? "ativo" : "inativo"}
                  exclusive
                  onChange={(_, val) => { if (val !== null) setAtivo(val === "ativo"); }}
                  size="small"
                  sx={{ "& .MuiToggleButton-root": { textTransform: "none", px: 2 } }}
                >
                  <ToggleButton value="ativo" color="success">
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <ToggleOnRoundedIcon fontSize="small" />
                      <span>Disponível</span>
                    </Stack>
                  </ToggleButton>
                  <ToggleButton value="inativo">
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <ToggleOffRoundedIcon fontSize="small" />
                      <span>Indisponível</span>
                    </Stack>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Grid>
            </Grid>
          </Grid>
        </Grid>

        <Collapse in={submitAttempted && Object.keys(errors).length > 0}>
          <Alert severity="error" sx={{ mt: 1, borderRadius: 2 }}>Corrija os campos destacados antes de salvar.</Alert>
        </Collapse>
      </DialogContent>

      <DialogActions
        sx={{
          px: 4,
          py: 2,
          borderTop: (t) => `1px solid ${t.palette.divider}`,
          justifyContent: "space-between",
          bgcolor: "background.paper",
        }}
      >
        <Box>
          {isEdit && onDelete && initial && (
            <>
              {!confirmDelete ? (
                <Button color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => setConfirmDelete(true)} sx={{ textTransform: "none", borderRadius: 999 }}>Excluir serviço</Button>
              ) : (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="error" fontWeight={600}>Confirmar exclusão?</Typography>
                  <Button color="error" variant="contained" size="small" onClick={() => onDelete(initial)} sx={{ textTransform: "none", borderRadius: 999 }}>Sim, excluir</Button>
                  <Button size="small" onClick={() => setConfirmDelete(false)} sx={{ textTransform: "none", borderRadius: 999 }}>Cancelar</Button>
                </Stack>
              )}
            </>
          )}
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button onClick={onClose} sx={{ textTransform: "none", borderRadius: 999, color: "text.secondary" }}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit} disableElevation sx={{ borderRadius: 999, px: 3.5, fontWeight: 700, background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.primary.dark})` }}>{isEdit ? "Salvar alterações" : "Cadastrar serviço"}</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}