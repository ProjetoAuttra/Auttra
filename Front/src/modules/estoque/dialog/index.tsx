import * as React from "react";
import {
  Box, Stack, TextField,
  Button, Typography, Grid, InputAdornment, CircularProgress,
} from "@mui/material";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import NumbersRoundedIcon from "@mui/icons-material/NumbersRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { AppDialog, AppDialogActions, AppDialogContent, SectionLabel } from "../../../components/common/AppDialog";

export type EstoqueItem = {
  id: number;
  nome: string;
  descricao?: string;
  preco_custo: number;
  preco_venda: number;
  estoque: number;
  created_at: string;
};

export type EstoqueForm = Omit<EstoqueItem, "id" | "created_at">;

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: EstoqueItem | null;
  onClose: () => void;
  onSubmit: (data: EstoqueForm) => Promise<void>;
  onDelete?: (item: EstoqueItem) => void;
};

export default function EstoqueDialog({ open, mode, initial, onClose, onSubmit, onDelete }: Props) {
  const isEdit = mode === "edit";

  const [form, setForm] = React.useState<EstoqueForm>({
    nome: "", descricao: "", preco_custo: 0, preco_venda: 0, estoque: 0,
  });
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setForm({
      nome: initial?.nome ?? "",
      descricao: initial?.descricao ?? "",
      preco_custo: initial?.preco_custo ?? 0,
      preco_venda: initial?.preco_venda ?? 0,
      estoque: initial?.estoque ?? 0,
    });
    setConfirmDelete(false);
  }, [open, initial]);

  const handleChange = (field: keyof EstoqueForm, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      title={isEdit ? "Editar peça" : "Nova peça"}
      icon={<Inventory2RoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <Grid container spacing={1.5}>
          <Grid size={12}>
            <SectionLabel>Informações da peça</SectionLabel>
          </Grid>

          <Grid size={12}>
            <TextField
              label="Nome *"
              value={form.nome}
              onChange={(e) => handleChange("nome", e.target.value)}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Inventory2RoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={12}>
            <TextField
              label="Descrição"
              value={form.descricao}
              onChange={(e) => handleChange("descricao", e.target.value)}
              size="small"
              fullWidth
              multiline
              rows={2}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start" sx={{ alignSelf: "flex-start", mt: 1 }}>
                    <DescriptionRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Preço de custo (R$)"
              type="number"
              value={form.preco_custo}
              onChange={(e) => handleChange("preco_custo", parseFloat(e.target.value))}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PaidRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Preço de venda (R$)"
              type="number"
              value={form.preco_venda}
              onChange={(e) => handleChange("preco_venda", parseFloat(e.target.value))}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PaidRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Estoque atual"
              type="number"
              value={form.estoque}
              onChange={(e) => handleChange("estoque", parseInt(e.target.value))}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <NumbersRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
        </Grid>
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
                  Excluir peça
                </Button>
              ) : (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="error" fontWeight={600}>Confirmar exclusão?</Typography>
                  <Button
                    color="error" variant="contained" size="small" disableElevation
                    onClick={() => { onDelete(initial); onClose(); }}
                    sx={{ borderRadius: 999 }}
                  >
                    Sim, excluir
                  </Button>
                  <Button size="small" onClick={() => setConfirmDelete(false)} sx={{ borderRadius: 999 }}>
                    Cancelar
                  </Button>
                </Stack>
              )}
            </>
          )}
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 999 }}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disableElevation
            disabled={saving}
            sx={{ borderRadius: 999, fontWeight: 700 }}
          >
            {saving ? <CircularProgress size={18} /> : (isEdit ? "Salvar alterações" : "Cadastrar peça")}
          </Button>
        </Stack>
      </AppDialogActions>
    </AppDialog>
  );
}
