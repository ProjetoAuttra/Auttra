import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
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
  details: string[];
  icon: React.ReactNode;
};

const resourceConfigs: ResourceConfig[] = [
  {
    id: "agenda",
    label: "Agenda",
    description: "Organize agendamentos, acompanhe compromissos e mantenha a rotina da oficina previsivel.",
    details: ["Calendario de servicos", "Vinculo com clientes e veiculos", "Status de atendimento"],
    icon: <EventOutlinedIcon />,
  },
  {
    id: "estoque",
    label: "Estoque",
    description: "Controle pecas e itens disponiveis para venda ou uso em ordens de servico.",
    details: ["Cadastro de itens", "Quantidade disponivel", "Precos de custo e venda"],
    icon: <Inventory2OutlinedIcon />,
  },
  {
    id: "fornecedores",
    label: "Fornecedores",
    description: "Mantenha contatos, compras e parceiros da oficina reunidos em um unico lugar.",
    details: ["Cadastro de parceiros", "Dados de contato", "Base para contas a pagar"],
    icon: <StorefrontOutlinedIcon />,
  },
];

const emptyResources = (): AdditionalResourcesMap =>
  Object.fromEntries(additionalResourceKeys.map((key) => [key, true])) as AdditionalResourcesMap;

export default function RecursosAdicionais() {
  const { resources, loading, save } = useAdditionalResources();
  const { can } = useAuth();
  const { success, error } = useToast();
  const [selectedId, setSelectedId] = React.useState<AdditionalResourceKey>("agenda");
  const [query, setQuery] = React.useState("");
  const [form, setForm] = React.useState<AdditionalResourcesMap>(emptyResources);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setForm(resources);
  }, [resources]);

  const canUpdate = can("recursos_adicionais", "update");
  const selected = resourceConfigs.find((item) => item.id === selectedId) ?? resourceConfigs[0];
  const filtered = resourceConfigs.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase())
  );

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
      error(err?.response?.data?.message ?? "Nao foi possivel salvar os recursos adicionais.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ py: { xs: 2, md: 4 } }}>
      <Stack spacing={0.75} mb={3}>
        <Typography variant="h5" fontWeight={700}>
          Recursos adicionais
        </Typography>
        <Typography color="text.secondary">
          Escolha quais recursos adicionais ficarao disponiveis para os usuarios desta oficina.
        </Typography>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} alignItems="stretch">
        <Box sx={{ width: { xs: "100%", md: 420 }, flexShrink: 0 }}>
          <TextField
            fullWidth
            variant="standard"
            placeholder="Pesquisar"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <SearchRoundedIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          <Paper elevation={0} sx={{ borderRadius: 1, border: (t) => `1px solid ${t.palette.divider}`, overflow: "hidden" }}>
            <List disablePadding>
              {filtered.map((item) => {
                const selectedItem = item.id === selectedId;
                const active = form[item.id];
                return (
                  <ListItemButton
                    key={item.id}
                    selected={selectedItem}
                    onClick={() => setSelectedId(item.id)}
                    sx={(t) => ({
                      minHeight: 72,
                      borderLeft: selectedItem ? `4px solid ${t.palette.primary.main}` : "4px solid transparent",
                      bgcolor: selectedItem ? alpha(t.palette.primary.main, 0.06) : "background.paper",
                      "&.Mui-selected": { bgcolor: alpha(t.palette.primary.main, 0.08) },
                    })}
                  >
                    <ListItemIcon sx={{ color: selectedItem ? "primary.main" : "text.secondary", minWidth: 42 }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={<Typography fontWeight={700}>{item.label}</Typography>}
                      secondary={active ? "Ativo" : "Inativo"}
                      secondaryTypographyProps={{ color: active ? "success.main" : "text.secondary", fontWeight: 700 }}
                    />
                    <Chip
                      label={active ? "Ativo" : "Inativo"}
                      size="small"
                      color={active ? "success" : "default"}
                      variant={active ? "filled" : "outlined"}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Paper>
        </Box>

        <Paper
          elevation={0}
          sx={{
            flex: 1,
            minHeight: 430,
            borderRadius: 1,
            border: (t) => `1px solid ${t.palette.divider}`,
            bgcolor: "background.paper",
            p: { xs: 2, md: 3 },
          }}
        >
          {loading ? (
            <Box sx={{ minHeight: 360, display: "grid", placeItems: "center" }}>
              <CircularProgress size={30} />
            </Box>
          ) : (
            <Stack spacing={3}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={(t) => ({
                      width: 54,
                      height: 54,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      color: t.palette.primary.main,
                      bgcolor: alpha(t.palette.primary.main, 0.12),
                    })}
                  >
                    {selected.icon}
                  </Box>
                  <Stack>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="h6" fontWeight={700}>
                        {selected.label}
                      </Typography>
                      <Chip label={form[selected.id] ? "Ativo" : "Inativo"} size="small" color={form[selected.id] ? "success" : "default"} />
                    </Stack>
                    <Typography color="text.secondary">{selected.description}</Typography>
                  </Stack>
                </Stack>

                <Switch
                  checked={form[selected.id]}
                  onChange={() => toggle(selected.id)}
                  disabled={!canUpdate || saving}
                  color="primary"
                />
              </Stack>

              <Divider />

              <Stack spacing={1.25}>
                <Typography fontWeight={700}>Itens incluidos</Typography>
                {selected.details.map((detail) => (
                  <Stack
                    key={detail}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ py: 1.2, borderBottom: (t) => `1px solid ${t.palette.divider}` }}
                  >
                    <Typography color="text.secondary">{detail}</Typography>
                    <Switch checked={form[selected.id]} disabled size="small" />
                  </Stack>
                ))}
              </Stack>

              <Alert severity="info" icon={<InfoOutlinedIcon />}>
                Os recursos desativados deixam de aparecer no menu lateral. O acesso a esta tela tambem depende da permissao no perfil de acesso.
              </Alert>

              <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  {activeCount} de {additionalResourceKeys.length} recurso(s) ativo(s)
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<SaveRoundedIcon />}
                  onClick={handleSave}
                  disabled={!canUpdate || saving || !hasChanges}
                  sx={{ borderRadius: 1, textTransform: "none", fontWeight: 600 }}
                >
                  Salvar alteracoes
                </Button>
              </Stack>
            </Stack>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}
