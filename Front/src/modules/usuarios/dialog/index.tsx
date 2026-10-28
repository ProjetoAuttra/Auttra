import * as React from "react";
import { Box, Stack, TextField, Button, MenuItem, CircularProgress } from "@mui/material";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import { useToast } from "../../../context/ToastContext";
import { listarPerfisAcesso, type PerfilAcesso } from "../../configuracoes/api/perfisAcesso";
import { maskTelefone } from "../../../utils/masks";
import { AppDrawer, DrawerSection } from "../../../components/common/AppDrawer";
import CampoData from "../../../components/common/CampoData";

// O valor enviado à API continua sem acento (enum do backend); só o rótulo exibido é acentuado.
const cargos = ["Mecanico", "Atendente", "Gerente", "Administrador"];
const cargoLabel = (c: string) => (c === "Mecanico" ? "Mecânico" : c);

export type FuncionarioForm = {
  nome: string;
  email: string;
  telefone: string;
  cargo: string;
  senha: string;
  data_contratacao: string;
  oficina_id: number;
  perfil_acesso_id?: number;
};

type Props = {
  open: boolean;
  mode?: "create" | "edit";
  initial?: any;
  onClose: () => void;
  onSubmit: (data: FuncionarioForm) => Promise<void>;
  oficina_id: number;
};

export default function FuncionarioDialog({ open, mode = "create", initial, onClose, onSubmit, oficina_id }: Props) {
  const { warning } = useToast();
  const isEdit = mode === "edit";

  const [form, setForm] = React.useState<FuncionarioForm>({
    nome: "", email: "", telefone: "", cargo: "Mecanico",
    senha: "", data_contratacao: new Date().toISOString(), oficina_id,
  });
  const [perfis, setPerfis] = React.useState<PerfilAcesso[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;

    listarPerfisAcesso().then((data) => {
      setPerfis(data);
      if (isEdit && initial) {
        setForm({
          nome: initial.nome ?? "",
          email: initial.email ?? "",
          telefone: maskTelefone(initial.telefone ?? ""),
          cargo: initial.cargo ?? "Mecanico",
          senha: "",
          data_contratacao: initial.data_contratacao ?? new Date().toISOString(),
          oficina_id,
          perfil_acesso_id: initial.perfil_acesso_id,
        });
      } else {
        const recepcao = data.find((p) => p.chave === "recepcao") ?? data.find((p) => p.padrao) ?? data[0];
        setForm({
          nome: "", email: "", telefone: "", cargo: "Mecanico",
          senha: "", data_contratacao: new Date().toISOString(),
          oficina_id, perfil_acesso_id: recepcao?.id,
        });
      }
    }).catch(() => setPerfis([]));
  }, [open, oficina_id, isEdit, initial]);

  const handleSubmit = async () => {
    if (!form.nome || !form.email || !form.telefone) {
      warning("Preencha todos os campos obrigatórios.");
      return;
    }
    if (!isEdit && (!form.senha || form.senha.length < 6)) {
      warning("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (isEdit && form.senha && form.senha.length < 6) {
      warning("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    const payload: FuncionarioForm = { ...form, data_contratacao: new Date().toISOString(), oficina_id };
    if (isEdit && !form.senha) delete (payload as any).senha;
    setSaving(true);
    try {
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  };

  const linha = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 } as const;

  const footer = (
    <>
      <Box />
      <Stack direction="row" spacing={1.5}>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
        <Button onClick={handleSubmit} variant="contained" disableElevation disabled={saving} sx={{ fontWeight: 700 }}>
          {saving ? <CircularProgress size={18} /> : (isEdit ? "Salvar alterações" : "Cadastrar funcionário")}
        </Button>
      </Stack>
    </>
  );

  return (
    <AppDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar funcionário" : "Novo funcionário"}
      subtitle={isEdit ? initial?.nome : "Cadastre os dados pessoais e o acesso ao sistema"}
      icon={<PersonRoundedIcon />}
      footer={footer}
    >
      <DrawerSection title="Dados pessoais">
        <Stack spacing={2}>
          <TextField
            label="Nome completo *"
            fullWidth
            size="small"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            autoFocus
          />
          <Box sx={linha}>
            <TextField
              label="E-mail *"
              fullWidth
              size="small"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <TextField
              label="Telefone *"
              fullWidth
              size="small"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: maskTelefone(e.target.value) })}
              inputProps={{ maxLength: 16 }}
            />
          </Box>
        </Stack>
      </DrawerSection>

      <DrawerSection title="Acesso ao sistema">
        <Stack spacing={2}>
          <Box sx={linha}>
            <TextField
              select
              label="Cargo"
              fullWidth
              size="small"
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
            >
              {cargos.map((c) => <MenuItem key={c} value={c}>{cargoLabel(c)}</MenuItem>)}
            </TextField>
            <TextField
              select
              label="Perfil de acesso"
              fullWidth
              size="small"
              value={form.perfil_acesso_id ?? ""}
              onChange={(e) => setForm({ ...form, perfil_acesso_id: Number(e.target.value) })}
            >
              {perfis.map((perfil) => <MenuItem key={perfil.id} value={perfil.id}>{perfil.nome}</MenuItem>)}
            </TextField>
          </Box>
          <Box sx={linha}>
            <TextField
              label={isEdit ? "Nova senha (opcional)" : "Senha de acesso *"}
              fullWidth
              size="small"
              type="password"
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              placeholder={isEdit ? "Deixe em branco para não alterar" : ""}
            />
            <CampoData
              label="Data de contratação"
              value={form.data_contratacao.split("T")[0]}
              onChange={(v) => { if (v) setForm({ ...form, data_contratacao: new Date(v).toISOString() }); }}
            />
          </Box>
        </Stack>
      </DrawerSection>
    </AppDrawer>
  );
}
