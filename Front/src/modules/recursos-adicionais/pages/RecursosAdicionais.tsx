import * as React from "react";
import { Box, Button, CircularProgress, Stack, Switch, Typography } from "@mui/material";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import WidgetsOutlinedIcon from "@mui/icons-material/WidgetsOutlined";
import ModuleHeader from "../../../components/layout/ModuleHeader";
import { useAdditionalResources } from "../../../context/AdditionalResourcesContext";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import {
  additionalResourceKeys,
  type AdditionalResourceKey,
  type AdditionalResourcesMap,
} from "../api/api";

type ResourceConfig = {
  id: AdditionalResourceKey;
  label: string;
  description: string;
  icon: React.ReactNode;
};

const resourceConfigs: ResourceConfig[] = [
  {
    id: "agenda",
    label: "Agenda",
    description: "Calendário de serviços, vínculo com clientes e veículos e situação de atendimento.",
    icon: <EventOutlinedIcon />,
  },
  {
    id: "estoque",
    label: "Estoque",
    description: "Cadastro de itens, quantidade disponível e preços de custo e venda.",
    icon: <Inventory2OutlinedIcon />,
  },
  {
    id: "fornecedores",
    label: "Fornecedores",
    description: "Cadastro de parceiros e dados de contato, base para contas a pagar.",
    icon: <StorefrontOutlinedIcon />,
  },
];

const emptyResources = (): AdditionalResourcesMap =>
  Object.fromEntries(additionalResourceKeys.map((key) => [key, true])) as AdditionalResourcesMap;

export default function RecursosAdicionais() {
  const { resources, loading, save } = useAdditionalResources();
  const { can } = useAuth();
  const { success, error } = useToast();
  const [form, setForm] = React.useState<AdditionalResourcesMap>(emptyResources);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setForm(resources);
  }, [resources]);

  const canUpdate = can("recursos_adicionais", "update");
  const activeCount = additionalResourceKeys.filter((key) => form[key]).length;
  const hasChanges = additionalResourceKeys.some((key) => form[key] !== resources[key]);

  const toggle = (id: AdditionalResourceKey) => {
    if (!canUpdate) return;
    setForm((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(form);
      success("Recursos adicionais atualizados com sucesso.");
    } catch (err: any) {
      error(err?.response?.data?.message ?? "Não foi possível salvar os recursos adicionais.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <ModuleHeader
        title="Recursos adicionais"
        subtitle="Escolha quais recursos ficam disponíveis para os usuários desta oficina."
        icon={<WidgetsOutlinedIcon />}
        actions={
          <Button
            variant="contained"
            startIcon={<SaveRoundedIcon />}
            onClick={handleSave}
            disabled={!canUpdate || saving || !hasChanges}
          >
            Salvar alterações
          </Button>
        }
      />

      {loading ? (
        <Box sx={{ textAlign: "center", mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box>
            {resourceConfigs.map((item) => (
              <Stack
                key={item.id}
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{ py: 2, borderTop: (t) => `1px solid ${t.palette.divider}` }}
              >
                <Box sx={{ display: "flex", color: "text.secondary", "& svg": { fontSize: 24 } }}>{item.icon}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={700}>{item.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.description}
                  </Typography>
                </Box>
                <Typography variant="body2" color={form[item.id] ? "success.main" : "text.secondary"} fontWeight={600} sx={{ minWidth: 52, textAlign: "right" }}>
                  {form[item.id] ? "Ativo" : "Inativo"}
                </Typography>
                <Switch
                  checked={form[item.id]}
                  onChange={() => toggle(item.id)}
                  disabled={!canUpdate || saving}
                  inputProps={{ "aria-label": `Ativar ${item.label}` }}
                />
              </Stack>
            ))}
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ pt: 2, borderTop: (t) => `1px solid ${t.palette.divider}` }}>
            {activeCount} de {additionalResourceKeys.length} recurso(s) ativo(s). Os desativados deixam de aparecer no menu lateral.
          </Typography>
        </>
      )}
    </Box>
  );
}
