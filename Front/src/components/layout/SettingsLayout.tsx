import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import { Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import MiscellaneousServicesIcon from "@mui/icons-material/MiscellaneousServices";
import WidgetsOutlinedIcon from "@mui/icons-material/WidgetsOutlined";
import { paths } from "../../routes/paths";
import { useAuth } from "../../context/AuthContext";
import type { AccessModule } from "../../permissions/accessProfiles";
import { brand } from "../../app/theme";

type SettingsItem = {
  label: string;
  icon: ReactNode;
  path: string;
  section?: string;
  module: AccessModule;
};

type SettingsGroup = { label: string; items: SettingsItem[] };

export const DEFAULT_SETTINGS_SECTION = "agenda";

const groups: SettingsGroup[] = [
  {
    label: "Oficina",
    items: [
      { label: "Agenda", icon: <EventOutlinedIcon />, path: paths.settings, section: "agenda", module: "configuracoes" },
      { label: "Financeiro", icon: <PaymentsOutlinedIcon />, path: paths.settings, section: "financeiro", module: "configuracoes" },
      { label: "Notificações", icon: <NotificationsNoneRoundedIcon />, path: paths.settings, section: "notificacoes", module: "configuracoes" },
    ],
  },
  {
    label: "Acesso",
    items: [
      { label: "Funcionários", icon: <PersonOutlineIcon />, path: paths.users, module: "funcionarios" },
      { label: "Perfis de acesso", icon: <SecurityOutlinedIcon />, path: paths.settings, section: "perfis", module: "configuracoes" },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { label: "Serviços", icon: <MiscellaneousServicesIcon />, path: paths.servicos, module: "servicos" },
      { label: "Recursos adicionais", icon: <WidgetsOutlinedIcon />, path: paths.recursosAdicionais, module: "recursos_adicionais" },
    ],
  },
];

/** Rotas que compõem a área de Configurações (usadas também pela sidebar). */
export const settingsPaths: string[] = [paths.settings, paths.users, paths.servicos, paths.recursosAdicionais];
export const settingsModules: AccessModule[] = ["configuracoes", "funcionarios", "servicos", "recursos_adicionais"];

/** Casco da área de Configurações: navegação lateral agrupada + conteúdo da seção. */
export default function SettingsLayout() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const { can } = useAuth();

  const currentSection = searchParams.get("section") ?? DEFAULT_SETTINGS_SECTION;
  const isSelected = (item: SettingsItem) =>
    pathname === item.path && (item.section ? item.section === currentSection : true);

  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => can(item.module)) }))
    .filter((group) => group.items.length > 0);

  const go = (item: SettingsItem) => nav(item.section ? `${item.path}?section=${item.section}` : item.path);

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto", display: "flex", flexDirection: { xs: "column", md: "row" }, gap: { xs: 2, md: 5 } }}>
      <Box
        component="nav"
        aria-label="Configurações"
        sx={{ width: { xs: "100%", md: 220 }, flexShrink: 0, alignSelf: "flex-start" }}
      >
        <Stack spacing={{ xs: 1, md: 2.5 }} direction={{ xs: "row", md: "column" }} sx={{ overflowX: { xs: "auto", md: "visible" }, pb: { xs: 0.5, md: 0 } }}>
          {visibleGroups.map((group) => (
            <Box key={group.label} sx={{ flexShrink: 0 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                fontWeight={700}
                sx={{ display: { xs: "none", md: "block" }, px: 1.5, mb: 0.5, textTransform: "uppercase", letterSpacing: 0.6 }}
              >
                {group.label}
              </Typography>
              <Stack direction={{ xs: "row", md: "column" }} spacing={0.25}>
                {group.items.map((item) => {
                  const selected = isSelected(item);
                  return (
                    <Stack
                      key={item.label}
                      direction="row"
                      alignItems="center"
                      spacing={1.25}
                      component="button"
                      type="button"
                      onClick={() => go(item)}
                      aria-current={selected ? "page" : undefined}
                      sx={{
                        font: "inherit",
                        border: 0,
                        cursor: "pointer",
                        textAlign: "left",
                        whiteSpace: "nowrap",
                        px: 1.5,
                        minHeight: 38,
                        borderRadius: 1.5,
                        fontSize: 14,
                        fontWeight: selected ? 700 : 500,
                        color: selected ? brand.primary : brand.muted,
                        bgcolor: selected ? alpha(brand.primary, 0.1) : "transparent",
                        "& svg": { fontSize: 20 },
                        "&:hover": { bgcolor: selected ? alpha(brand.primary, 0.14) : brand.subtleStrong, color: selected ? brand.primary : brand.ink },
                      }}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Stack>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
