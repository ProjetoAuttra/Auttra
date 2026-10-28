import * as React from "react";
import {
  Box, Stack, TextField,
  Button, Typography, InputAdornment, CircularProgress,
} from "@mui/material";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { useCep } from "../../../hooks/useCep";
import api from "../../../api/api";
import { maskCep } from "../../../utils/masks";
import { AppDrawer, DrawerSection } from "../../../components/common/AppDrawer";

export type Supplier = {
  id: string;
  nome: string;
  contato?: string;
  telefone?: string;
  email?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  cep?: string;
  cidade_id?: number | null;
  cidade?: { nome: string; uf: string } | null;
  created_at: string;
};

export type SupplierForm = {
  nome: string;
  contato?: string;
  telefone?: string;
  email?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  cep?: string;
  cidade_id?: number | null;
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Supplier | null;
  onClose: () => void;
  onSubmit: (data: SupplierForm) => Promise<void>;
  onDelete?: (supplier: Supplier) => void;
};

export default function SupplierDialog({ open, mode, initial, onClose, onSubmit, onDelete }: Props) {
  const isEdit = mode === "edit";
  const { buscar, loading: cepLoading, erro: cepErro, setErro: setCepErro } = useCep();

  const [form, setForm] = React.useState<SupplierForm>({
    nome: "", contato: "", telefone: "", email: "",
    logradouro: "", numero: "", complemento: "", cep: "", cidade_id: null,
  });
  const [cidadeNome, setCidadeNome] = React.useState("");
  const [uf, setUf] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setForm({
      nome: initial?.nome ?? "",
      contato: initial?.contato ?? "",
      telefone: initial?.telefone ?? "",
      email: initial?.email ?? "",
      logradouro: initial?.logradouro ?? "",
      numero: initial?.numero ?? "",
      complemento: initial?.complemento ?? "",
      cep: initial?.cep ?? "",
      cidade_id: initial?.cidade_id ?? null,
    });
    setCidadeNome(initial?.cidade?.nome ?? "");
    setUf(initial?.cidade?.uf ?? "");
    setConfirmDelete(false);
    setCepErro(null);
  }, [open, initial]);

  const handleChange = (field: keyof SupplierForm, value: string | number | null) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleCepChange = async (raw: string) => {
    handleChange("cep", raw);
    if (raw.length !== 8) return;
    const dados = await buscar(raw);
    if (!dados) return;
    handleChange("logradouro", dados.logradouro);
    setCidadeNome(dados.cidade);
    setUf(dados.uf);
    try {
      const res = await api.post("/cidade", { nome: dados.cidade, uf: dados.uf });
      handleChange("cidade_id", res.data.id);
    } catch {
      handleChange("cidade_id", null);
    }
  };

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
              Excluir fornecedor
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
          {saving ? <CircularProgress size={18} /> : (isEdit ? "Salvar alterações" : "Cadastrar fornecedor")}
        </Button>
      </Stack>
    </>
  );

  return (
    <AppDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar fornecedor" : "Novo fornecedor"}
      subtitle={isEdit ? initial?.nome : "Cadastre os dados de contato e o endereço"}
      icon={<BusinessRoundedIcon />}
      footer={footer}
    >
      <DrawerSection title="Dados do fornecedor">
        <Stack spacing={2}>
          <TextField
            label="Nome do fornecedor *"
            value={form.nome}
            onChange={(e) => handleChange("nome", e.target.value)}
            size="small"
            fullWidth
            autoFocus
          />
          <Box sx={linha}>
            <TextField label="Contato" value={form.contato} onChange={(e) => handleChange("contato", e.target.value)} size="small" fullWidth />
            <TextField label="Telefone" value={form.telefone} onChange={(e) => handleChange("telefone", e.target.value)} size="small" fullWidth />
          </Box>
          <TextField label="E-mail" value={form.email} onChange={(e) => handleChange("email", e.target.value)} size="small" fullWidth type="email" />
        </Stack>
      </DrawerSection>

      <DrawerSection title="Endereço">
        <Stack spacing={2}>
          <Box sx={linha}>
            <TextField
              label="CEP"
              value={maskCep(form.cep ?? "")}
              size="small"
              fullWidth
              error={!!cepErro}
              helperText={cepErro ?? undefined}
              onChange={(e) => handleCepChange(e.target.value.replace(/\D/g, "").slice(0, 8))}
              InputProps={{ endAdornment: cepLoading ? <InputAdornment position="end"><CircularProgress size={14} /></InputAdornment> : undefined }}
            />
            <TextField label="Número" value={form.numero} onChange={(e) => handleChange("numero", e.target.value)} size="small" fullWidth />
          </Box>
          <TextField label="Logradouro" value={form.logradouro} onChange={(e) => handleChange("logradouro", e.target.value)} size="small" fullWidth />
          <TextField label="Complemento" value={form.complemento} onChange={(e) => handleChange("complemento", e.target.value)} size="small" fullWidth />
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 2 }}>
            <TextField
              label="Cidade"
              value={cidadeNome}
              size="small"
              fullWidth
              disabled
              helperText={cidadeNome ? undefined : "Preenchido automaticamente pelo CEP"}
            />
            <TextField label="UF" value={uf} size="small" fullWidth disabled inputProps={{ maxLength: 2 }} />
          </Box>
        </Stack>
      </DrawerSection>
    </AppDrawer>
  );
}
