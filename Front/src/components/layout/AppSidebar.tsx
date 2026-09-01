import {
  Drawer, Box, List, ListItemButton, ListItemIcon, ListItemText,
  useTheme, Tooltip, Divider, Collapse, Toolbar
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import HomeOutlineIcon from '@mui/icons-material/HomeOutlined';
import EventOutlineIcon from '@mui/icons-material/EventOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutlined';
import ChecklistOutlineIcon from '@mui/icons-material/ChecklistOutlined';
import PaymentsOutlineIcon from '@mui/icons-material/PaymentsOutlined';
import RequestQuoteOutlineIcon from '@mui/icons-material/RequestQuoteOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
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
import MiscellaneousServicesIcon from '@mui/icons-material/MiscellaneousServices';
import WidgetsOutlinedIcon from '@mui/icons-material/WidgetsOutlined';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { paths } from '../../routes/paths';
import { useSidebar } from '../../context/SidebarContext';
import { useAuth } from '../../context/AuthContext';
import { useAdditionalResources } from '../../context/AdditionalResourcesContext';
import type { AccessModule } from '../../permissions/accessProfiles';

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
    label: 'Estoque',
    icon: <InventoryIcon />,
    to: '#estoque',
    subItems: [
      { label: 'Estoque', icon: <InventoryIcon />, to: paths.estoque, module: 'estoque' },
      { label: 'Fornecedores', icon: <StoreIcon />, to: paths.fornecedores, module: 'fornecedores' },
    ],
  },
  { label: 'Relatórios', icon: <BarChartOutlineIcon />, to: paths.reports, module: 'relatorios' },
  {
    label: 'Configurações',
    icon: <SettingsOutlineIcon />,
    to: '#configuracoes',
    subItems: [
      { label: 'Configurações gerais', icon: <SettingsOutlineIcon />, to: paths.settings, module: 'configuracoes' },
      { label: 'Funcionários', icon: <PersonOutlineIcon />, to: paths.users, module: 'funcionarios' },
      { label: 'Perfis de acesso', icon: <SecurityRoundedIcon />, to: `${paths.settings}?section=perfis`, module: 'configuracoes' },
      { label: 'Serviços', icon: <MiscellaneousServicesIcon />, to: paths.servicos, module: 'servicos' },
      { label: 'Recursos adicionais', icon: <WidgetsOutlinedIcon />, to: paths.recursosAdicionais, module: 'recursos_adicionais' },
    ],
  },
];

const navLabels: Record<string, string> = {
  [paths.root]: 'Início',
  [paths.agenda]: 'Agenda',
  [paths.clients]: 'Clientes',
  [paths.veiculos]: 'Veículos',
  [paths.estoque]: 'Estoque',
  [paths.servicos]: 'Serviços',
  [paths.tasks]: 'Ordens de serviço',
  [paths.payments]: 'Extrato',
  [paths.fornecedores]: 'Fornecedores',
  [paths.quotes]: 'Orçamentos',
  [paths.users]: 'Funcionários',
  [paths.reports]: 'Relatórios',
  [paths.settings]: 'Configurações gerais',
  [paths.recursosAdicionais]: 'Recursos adicionais',
  [paths.contasReceber]: 'Recebimentos',
  [paths.contasPagar]: 'Pagamentos',
};

const moduleResourceMap: Partial<Record<AccessModule, 'agenda' | 'estoque' | 'fornecedores'>> = {
  agenda: 'agenda',
  estoque: 'estoque',
  fornecedores: 'fornecedores',
};

function NavList({ onItemClick, collapsed }: { onItemClick?: () => void; collapsed?: boolean }) {
  const { pathname, search } = useLocation();
  const nav = useNavigate();
  const theme = useTheme();
  const { can } = useAuth();
  const { isEnabled } = useAdditionalResources();

  const isSubSelected = (subTo: string) => {
    const [basePath, queryString] = subTo.split('?');
    if (pathname !== basePath) return false;
    if (!queryString) return !search; // sem query no subitem → só ativo quando URL também não tem query
    return search === `?${queryString}`;
  };

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

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <List sx={{ px: collapsed ? 1 : 1.5, py: 0.5, flex: 1, overflow: 'auto' }}>
      {navItems.filter((item) => {
        if (item.subItems) return getAllowedSubItems(item.subItems).length > 0;
        return item.module ? isItemVisible(item.module) : false;
      }).map(({ label, icon, to, subItems }) => {
        const allowedSubItems = getAllowedSubItems(subItems);
        const displayLabel = subItems?.length ? label : navLabels[to] ?? label;
        const selected =
          (to === paths.root && pathname === '/') ||
          (to === pathname && !to.startsWith('#')) ||
          allowedSubItems.some((s) => pathname === s.to.split('?')[0]);
        const isOpen = !!openMenus[label];

        const button = (
          <ListItemButton
            key={to}
            selected={selected}
            onClick={() => {
              if (allowedSubItems.length > 0) toggleMenu(label);
              else {
                nav(to);
                onItemClick?.();
              }
            }}
            sx={{
              my: 0.25,
              minHeight: 52,
              borderRadius: 2,
              px: collapsed ? 0 : 2,
              justifyContent: collapsed ? 'center' : 'flex-start',
              bgcolor: selected ? theme.palette.primary.main : 'transparent',
              color: selected ? '#FFFFFF' : '#667085',
              transition: 'background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease',
              border: '1px solid transparent',
              boxShadow: selected ? `0 14px 28px ${alpha(theme.palette.primary.main, 0.28)}` : 'none',
              '&:hover': {
                bgcolor: selected ? theme.palette.primary.dark : alpha(theme.palette.primary.main, 0.08),
                color: selected ? '#FFFFFF' : theme.palette.primary.main,
              },
              '&.Mui-selected': { bgcolor: theme.palette.primary.main },
              '&.Mui-selected:hover': { bgcolor: theme.palette.primary.dark },
            }}
          >
            <ListItemIcon sx={{ minWidth: collapsed ? 0 : 38, justifyContent: 'center', color: 'inherit' }}>
              {icon}
            </ListItemIcon>

            {!collapsed && (
              <ListItemText
                primary={displayLabel}
                primaryTypographyProps={{ fontSize: 14, fontWeight: selected ? 750 : 650 }}
              />
            )}
            {!collapsed && allowedSubItems.length > 0 && (isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />)}
          </ListItemButton>
        );

        return (
          <Box key={label}>
            {collapsed ? (
              <Tooltip title={displayLabel} placement="right" arrow>
                {button}
              </Tooltip>
            ) : (
              button
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
                        pl: 6,
                        py: 0.75,
                        minHeight: 36,
                        borderRadius: 1.5,
                        color: pathname === sub.to ? theme.palette.primary.main : theme.palette.text.secondary,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.text.primary, 0.045),
                          color: theme.palette.text.primary,
                        },
                        '&.Mui-selected': {
                          bgcolor: alpha(theme.palette.primary.main, 0.09),
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36, justifyContent: 'center', color: 'inherit' }}>
                        {sub.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={navLabels[sub.to] ?? sub.label}
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
  const { collapsed } = useSidebar();
  const collapsedWidth = 68;
  const currentWidth = collapsed ? collapsedWidth : drawerWidth;

  const content = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#FFFFFF',
        color: theme.palette.text.primary,
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 64, md: 88 }, flexShrink: 0 }} />

      <Divider sx={{ flexShrink: 0 }} />
      <NavList onItemClick={onCloseMobile} collapsed={collapsed} />
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
            bgcolor: '#ffffff',
            borderRight: (t) => `1px solid ${t.palette.divider}`,
          },
        }}
      >
        {content}
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
            borderRight: (t) => `1px solid ${t.palette.divider}`,
            borderRadius: 0,
            bgcolor: '#FFFFFF',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            overflowX: 'hidden',
          },
        }}
      >
        {content}
      </Drawer>
    </>
  );
}
