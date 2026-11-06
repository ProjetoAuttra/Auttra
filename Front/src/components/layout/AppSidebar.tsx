import {
  Drawer, Box, List, ListItemButton, ListItemIcon, ListItemText,
  useTheme, Tooltip, Collapse, Toolbar, IconButton, Menu, MenuItem
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import HomeOutlineIcon from '@mui/icons-material/HomeOutlined';
import EventOutlineIcon from '@mui/icons-material/EventOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutlined';
import ChecklistOutlineIcon from '@mui/icons-material/ChecklistOutlined';
import PaymentsOutlineIcon from '@mui/icons-material/PaymentsOutlined';
import RequestQuoteOutlineIcon from '@mui/icons-material/RequestQuoteOutlined';
import BarChartOutlineIcon from '@mui/icons-material/BarChartOutlined';
import SettingsOutlineIcon from '@mui/icons-material/SettingsOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import InventoryIcon from '@mui/icons-material/Inventory';
import StoreIcon from '@mui/icons-material/Store';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import MiscellaneousServicesIcon from '@mui/icons-material/MiscellaneousServices';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { paths } from '../../routes/paths';
import { useSidebar } from '../../context/SidebarContext';
import { useAuth } from '../../context/AuthContext';
import { useSystemResources } from '../../context/SystemResourcesContext';
import type { AccessModule } from '../../permissions/accessProfiles';
import { brand } from '../../app/theme';
import BrandLogoPlaceholder from './BrandLogoPlaceholder';
import { settingsModules, settingsPaths } from './SettingsLayout';

type Props = {
  drawerWidth: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
};

type SubItem = { label: string; icon: ReactNode; to: string; module: AccessModule };

type NavItem = {
  label: string;
  icon: ReactNode;
  to: string;
  module?: AccessModule;
  subItems?: SubItem[];
};

const navItems: NavItem[] = [
  { label: 'Início', icon: <HomeOutlineIcon />, to: paths.root, module: 'painel' },
  { label: 'Agenda', icon: <EventOutlineIcon />, to: paths.agenda, module: 'agenda' },
  { label: 'Clientes', icon: <PeopleOutlineIcon />, to: paths.clients, module: 'clientes' },
  { label: 'Veículos', icon: <DirectionsCarIcon />, to: paths.veiculos, module: 'veiculos' },
  { label: 'Orçamentos', icon: <RequestQuoteOutlineIcon />, to: paths.quotes, module: 'orcamentos' },
  { label: 'Ordens de serviço', icon: <ChecklistOutlineIcon />, to: paths.tasks, module: 'ordens' },
  {
    label: 'Financeiro',
    icon: <PaymentsOutlineIcon />,
    to: '#financeiro',
    subItems: [
      { label: 'Extrato', icon: <AccountBalanceWalletOutlinedIcon />, to: paths.payments, module: 'financeiro' },
      { label: 'Recebimentos', icon: <ArrowDownwardRoundedIcon />, to: paths.contasReceber, module: 'financeiro' },
      { label: 'Pagamentos', icon: <ArrowUpwardRoundedIcon />, to: paths.contasPagar, module: 'financeiro' },
    ],
  },
  {
    label: 'Catálogo',
    icon: <CategoryOutlinedIcon />,
    to: '#catalogo',
    subItems: [
      { label: 'Peças', icon: <InventoryIcon />, to: paths.estoque, module: 'estoque' },
      { label: 'Serviços', icon: <MiscellaneousServicesIcon />, to: paths.servicos, module: 'servicos' },
      { label: 'Fornecedores', icon: <StoreIcon />, to: paths.fornecedores, module: 'fornecedores' },
    ],
  },
  { label: 'Relatórios', icon: <BarChartOutlineIcon />, to: paths.reports, module: 'relatorios' },
  { label: 'Configurações', icon: <SettingsOutlineIcon />, to: paths.settings, module: 'configuracoes' },
];

const moduleResourceMap: Partial<Record<AccessModule, 'agenda' | 'estoque' | 'fornecedores'>> = {
  agenda: 'agenda',
  estoque: 'estoque',
  fornecedores: 'fornecedores',
};

// Telas cujo caminho não começa pelo do item do menu, mas pertencem a ele.
const prefixosExtras: Record<string, string[]> = {
  [paths.tasks]: ['/ordens'],
};

/** Ativo na própria tela e nas filhas (/clientes/12, /orcamentos/novo, /ordens/5 → Ordens de serviço). */
function caminhoAtivo(pathname: string, to: string) {
  const base = to.split('?')[0];
  if (base === paths.root) return pathname === paths.root;
  return [base, ...(prefixosExtras[base] ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Última tela visitada dentro de Configurações, para voltar nela ao reabrir o item da sidebar.
let lastSettingsLocation: string = paths.settings;

function NavList({ onItemClick, collapsed }: { onItemClick?: () => void; collapsed?: boolean }) {
  const { pathname, search } = useLocation();
  const nav = useNavigate();
  const { can } = useAuth();
  const { isEnabled } = useSystemResources();

  const isSubSelected = (subTo: string) => {
    const [basePath, queryString] = subTo.split('?');
    if (!caminhoAtivo(pathname, basePath)) return false;
    // Subitem sem query fica ativo com qualquer filtro na URL (ex.: ?situacao=vencido).
    return !queryString || search === `?${queryString}`;
  };

  // Barra recolhida: o Collapse dos subitens não aparece, então eles abrem num menu ao lado do ícone.
  const [submenu, setSubmenu] = useState<{ label: string; anchor: HTMLElement } | null>(null);

  useEffect(() => {
    if (settingsPaths.includes(pathname)) lastSettingsLocation = `${pathname}${search}`;
  }, [pathname, search]);

  const isSettingsVisible = settingsModules.some((module) => can(module));

  const isItemVisible = (module: AccessModule) => {
    const resource = moduleResourceMap[module];
    return can(module) && (!resource || isEnabled(resource));
  };

  const getAllowedSubItems = (subItems?: SubItem[]) =>
    subItems?.filter((s) => isItemVisible(s.module)) ?? [];

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of navItems) {
      if (item.subItems?.some((s) => isSubSelected(s.to))) {
        initial[item.label] = true;
      }
    }
    return initial;
  });

  // Ao chegar numa tela por fora do menu (ex.: clique numa notificação), expande o grupo dela.
  useEffect(() => {
    const grupos = navItems
      .filter((item) => item.subItems?.some((s) => isItemVisible(s.module) && isSubSelected(s.to)))
      .map((item) => item.label);
    if (grupos.length === 0) return;
    setOpenMenus((prev) => (grupos.every((g) => prev[g]) ? prev : { ...prev, ...Object.fromEntries(grupos.map((g) => [g, true])) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <List sx={{ px: collapsed ? 1 : 1.5, py: 0.5, flex: 1, overflow: 'auto' }}>
      {navItems.filter((item) => {
        if (item.subItems) return getAllowedSubItems(item.subItems).length > 0;
        if (item.to === paths.settings) return isSettingsVisible;
        return item.module ? isItemVisible(item.module) : false;
      }).map(({ label, icon, to, subItems }) => {
        const allowedSubItems = getAllowedSubItems(subItems);
        const selected =
          (!to.startsWith('#') && caminhoAtivo(pathname, to)) ||
          (to === paths.settings && settingsPaths.includes(pathname)) ||
          allowedSubItems.some((s) => isSubSelected(s.to));
        const isOpen = !!openMenus[label];

        const button = (
          <ListItemButton
            key={to}
            selected={selected}
            aria-haspopup={collapsed && allowedSubItems.length > 0 ? 'menu' : undefined}
            aria-expanded={collapsed && allowedSubItems.length > 0 ? submenu?.label === label : undefined}
            onClick={(e) => {
              if (allowedSubItems.length > 0) {
                if (collapsed) setSubmenu({ label, anchor: e.currentTarget });
                else toggleMenu(label);
              } else {
                if (to === paths.settings) {
                  // Já dentro de Configurações: mantém a seção atual; fora: volta à última visitada.
                  if (!settingsPaths.includes(pathname)) nav(lastSettingsLocation);
                } else {
                  nav(to);
                }
                onItemClick?.();
              }
            }}
            sx={{
              my: 0.25,
              minHeight: 44,
              borderRadius: 1.5,
              px: collapsed ? 0 : 2,
              justifyContent: collapsed ? 'center' : 'flex-start',
              bgcolor: selected ? alpha(brand.primary, 0.1) : 'transparent',
              color: selected ? brand.primary : brand.muted,
              transition: 'background 0.16s ease, color 0.16s ease',
              border: '1px solid transparent',
              '&:hover': {
                bgcolor: selected ? alpha(brand.primary, 0.14) : brand.subtleStrong,
                color: selected ? brand.primary : brand.ink,
              },
              '&.Mui-selected': { bgcolor: alpha(brand.primary, 0.1) },
              '&.Mui-selected:hover': { bgcolor: alpha(brand.primary, 0.14) },
            }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 0 : 38, justifyContent: 'center', color: 'inherit', '& svg': { fontSize: 20 } }}>
              {icon}
            </ListItemIcon>

            {!collapsed && (
              <ListItemText
                primary={label}
                primaryTypographyProps={{ fontSize: 14, fontWeight: selected ? 700 : 600 }}
              />
            )}
            {!collapsed && allowedSubItems.length > 0 && (isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />)}
          </ListItemButton>
        );

        return (
          <Box key={label}>
            {collapsed ? (
              <Tooltip title={label} placement="right" arrow>
                {button}
              </Tooltip>
            ) : (
              button
            )}

            {collapsed && allowedSubItems.length > 0 && (
              <Menu
                anchorEl={submenu?.label === label ? submenu.anchor : null}
                open={submenu?.label === label}
                onClose={() => setSubmenu(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{ paper: { sx: { ml: 1, minWidth: 180 } } }}
              >
                {allowedSubItems.map((sub) => (
                  <MenuItem
                    key={sub.label}
                    selected={isSubSelected(sub.to)}
                    onClick={() => {
                      setSubmenu(null);
                      nav(sub.to);
                      onItemClick?.();
                    }}
                    sx={{
                      fontSize: 13,
                      gap: 1.5,
                      '& svg': { fontSize: 18 },
                      '&.Mui-selected': { bgcolor: alpha(brand.primary, 0.08), color: brand.primary },
                    }}
                  >
                    {sub.icon}
                    {sub.label}
                  </MenuItem>
                ))}
              </Menu>
            )}

            {!collapsed && allowedSubItems.length > 0 && (
              <Collapse in={isOpen} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {allowedSubItems.map((sub) => (
                    <ListItemButton
                      key={sub.label}
                      selected={isSubSelected(sub.to)}
                      onClick={() => {
                        nav(sub.to);
                        onItemClick?.();
                      }}
                      sx={{
                        pl: 5,
                        py: 0.75,
                        minHeight: 36,
                        borderRadius: 1.5,
                        color: brand.muted,
                        '&:hover': {
                          bgcolor: brand.subtleStrong,
                          color: brand.ink,
                        },
                        '&.Mui-selected': {
                          bgcolor: alpha(brand.primary, 0.08),
                          color: brand.primary,
                        },
                        '&.Mui-selected:hover': { bgcolor: alpha(brand.primary, 0.12) },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 30, justifyContent: 'flex-start', color: 'inherit', '& svg': { fontSize: 18 } }}>
                        {sub.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={sub.label}
                        primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Collapse>
            )}
          </Box>
        );
      })}
    </List>
  );
}

export default function AppSidebar({
  drawerWidth,
  mobileOpen = false,
  onCloseMobile,
}: Props) {
  const theme = useTheme();
  const { collapsed, toggleCollapsed } = useSidebar();
  const collapsedWidth = 68;
  const currentWidth = collapsed ? collapsedWidth : drawerWidth;

  // No drawer mobile a sidebar nunca é recolhida.
  const renderContent = (isCollapsed: boolean, showToggle: boolean) => (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: brand.subtle,
        color: 'text.primary',
      }}
    >
      <Toolbar
        sx={{
          flexShrink: 0,
          px: 0,
          justifyContent: 'center',
        }}
      >
        <BrandLogoPlaceholder compact={isCollapsed} />
      </Toolbar>

      <NavList onItemClick={onCloseMobile} collapsed={isCollapsed} />

      {showToggle && (
        <Box
          sx={{
            flexShrink: 0,
            p: 1.5,
            display: 'flex',
            justifyContent: isCollapsed ? 'center' : 'flex-end',
          }}
        >
          <Tooltip title={isCollapsed ? 'Expandir menu' : 'Recolher menu'} placement="right">
            <IconButton
              onClick={toggleCollapsed}
              size="small"
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                color: brand.muted,
                '&:hover': { bgcolor: brand.subtleStrong, color: brand.ink },
              }}
            >
              {isCollapsed ? <ChevronRightRoundedIcon fontSize="small" /> : <ChevronLeftRoundedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );

  return (
    <>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onCloseMobile}
        ModalProps={{ keepMounted: true }}
        PaperProps={{ elevation: 0 }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            bgcolor: brand.subtle,
            border: 'none',
          },
        }}
      >
        {renderContent(false, false)}
      </Drawer>
      <Drawer
        variant="permanent"
        open
        PaperProps={{ elevation: 0 }}
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: currentWidth,
            boxSizing: 'border-box',
            top: 0,
            left: 0,
            height: '100dvh',
            border: 'none',
            borderRadius: 0,
            bgcolor: brand.subtle,
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            overflowX: 'hidden',
          },
        }}
      >
        {renderContent(collapsed, true)}
      </Drawer>
    </>
  );
}
