import * as React from "react";
import { Box, Stack, TextField, Button, Typography, CircularProgress } from "@mui/material";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { AppDrawer, DrawerSection } from "../../../components/common/AppDrawer";

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

  const linha = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 } as const;

  const footer = (
    <>
      <Box>
        {isEdit && onDelete && initial && (
          !confirmDelete ? (
            <Button color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => setConfirmDelete(true)}>
              Excluir peça
            </Button>
          ) : (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="error" fontWeight={600}>Confirmar exclusão?</Typography>
              <Button
                color="error" variant="contained" size="small" disableElevation
                onClick={() => { onDelete(initial); onClose(); }}
              >
                Sim, excluir
              </Button>
              <Button size="small" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            </Stack>
          )
        )}
      </Box>
      <Stack direction="row" spacing={1.5}>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
        <Button onClick={handleSubmit} variant="contained" disableElevation disabled={saving} sx={{ fontWeight: 700 }}>
          {saving ? <CircularProgress size={18} /> : (isEdit ? "Salvar alterações" : "Cadastrar peça")}
        </Button>
      </Stack>
    </>
  );

  return (
    <AppDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar peça" : "Nova peça"}
      subtitle={isEdit ? initial?.nome : "Cadastre a peça com preços e quantidade em estoque"}
      icon={<Inventory2RoundedIcon />}
      footer={footer}
    >
      <DrawerSection title="Dados da peça">
        <Stack spacing={2}>
          <TextField
            label="Nome *"
            value={form.nome}
            onChange={(e) => handleChange("nome", e.target.value)}
            size="small"
            fullWidth
            autoFocus
          />
          <TextField
            label="Descrição"
            value={form.descricao}
            onChange={(e) => handleChange("descricao", e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={3}
          />
        </Stack>
      </DrawerSection>

      <DrawerSection title="Preços e estoque">
        <Stack spacing={2}>
          <Box sx={linha}>
            <TextField
              label="Preço de custo (R$)"
              type="number"
              value={form.preco_custo}
              onChange={(e) => handleChange("preco_custo", parseFloat(e.target.value))}
              size="small"
              fullWidth
            />
            <TextField
              label="Preço de venda (R$)"
              type="number"
              value={form.preco_venda}
              onChange={(e) => handleChange("preco_venda", parseFloat(e.target.value))}
              size="small"
              fullWidth
            />
          </Box>
          <Box sx={linha}>
            <TextField
              label="Estoque atual"
              type="number"
              value={form.estoque}
              onChange={(e) => handleChange("estoque", parseInt(e.target.value))}
              size="small"
              fullWidth
            />
          </Box>
        </Stack>
      </DrawerSection>
    </AppDrawer>
  );
}
