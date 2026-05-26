import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Box, Typography, List, ListItemButton, ListItemIcon, ListItemText,
  IconButton, Tooltip, Divider, Avatar, Drawer, AppBar, Toolbar,
  useMediaQuery, useTheme,
} from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import { useAuth } from "../context/AuthContext";
import { MinhaContaDialog } from "../modules/auth/dialog/MinhaContaDialog";

const SIDEBAR_WIDTH = 220;

const navItems = [
  { label: "Dashboard", icon: <DashboardRoundedIcon fontSize="small" />, to: "/" },
  { label: "Oficinas", icon: <BusinessRoundedIcon fontSize="small" />, to: "/oficinas" },
  { label: "Usuários", icon: <PeopleRoundedIcon fontSize="small" />, to: "/usuarios" },
  { label: "Administradores", icon: <AdminPanelSettingsRoundedIcon fontSize="small" />, to: "/admins" },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [contaOpen, setContaOpen] = useState(false);

  const lastLogin = user?.last_login_at
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(user.last_login_at))
    : null;

  function handleSignOut() {
    signOut();
    navigate("/login");
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ px: 2.5, py: 2.5, display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ width: 28, height: 28, bgcolor: "#111827", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography sx={{ color: "#fff", fontSize: 12, fontWeight: 800, lineHeight: 1 }}>D</Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>DriveOn</Typography>
          <Typography sx={{ fontSize: 10, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Admin
          </Typography>
        </Box>
      </Box>

      <Divider />

      <Box sx={{ px: 1.5, py: 1.5, flex: 1 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", px: 1, mb: 0.5 }}>
          Menu
        </Typography>
        <List dense disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
          {navItems.map((item) => (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              end={item.to === "/"}
              onClick={onNavigate}
              sx={{
                py: 0.75, px: 1, borderRadius: 1,
                "&.active": {
                  bgcolor: "#f3f4f6",
                  "& .MuiListItemText-primary": { fontWeight: 600, color: "#111827" },
                  "& .MuiListItemIcon-root": { color: "#111827" },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 30, color: "text.secondary" }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{ primary: { sx: { fontSize: 14 } } }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>

      <Divider />

      <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar sx={{ width: 28, height: 28, bgcolor: "#e5e7eb", color: "#374151", fontSize: 12, fontWeight: 700 }}>
          {user?.nome?.[0]?.toUpperCase() ?? "A"}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {user?.nome}
          </Typography>
          <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
            {lastLogin ? `Acesso em ${lastLogin}` : "Sistema"}
          </Typography>
        </Box>
        <Tooltip title="Minha conta">
          <IconButton size="small" onClick={() => setContaOpen(true)} sx={{ color: "text.secondary" }}>
            <ManageAccountsRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Sair">
          <IconButton size="small" onClick={handleSignOut} sx={{ color: "text.secondary" }}>
            <LogoutRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <MinhaContaDialog open={contaOpen} onClose={() => setContaOpen(false)} />
    </Box>
  );
}

export function AdminLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {isMobile ? (
        <>
          <AppBar
            position="fixed"
            elevation={0}
            sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider", color: "text.primary" }}
          >
            <Toolbar sx={{ gap: 1.5, minHeight: "52px !important" }}>
              <IconButton size="small" onClick={() => setDrawerOpen(true)} edge="start">
                <MenuRoundedIcon fontSize="small" />
              </IconButton>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 24, height: 24, bgcolor: "#111827", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography sx={{ color: "#fff", fontSize: 10, fontWeight: 800, lineHeight: 1 }}>D</Typography>
                </Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700 }}>DriveOn Admin</Typography>
              </Box>
            </Toolbar>
          </AppBar>
          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            sx={{ "& .MuiDrawer-paper": { width: SIDEBAR_WIDTH } }}
          >
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </Drawer>
          <Box component="main" sx={{ flex: 1, mt: "52px", minHeight: "calc(100vh - 52px)" }}>
            <Outlet />
          </Box>
        </>
      ) : (
        <>
          <Box
            component="nav"
            sx={{
              width: SIDEBAR_WIDTH,
              flexShrink: 0,
              bgcolor: "background.paper",
              borderRight: "1px solid",
              borderColor: "divider",
              position: "fixed",
              top: 0,
              bottom: 0,
            }}
          >
            <SidebarContent />
          </Box>
          <Box sx={{ flex: 1, ml: `${SIDEBAR_WIDTH}px`, minHeight: "100vh" }}>
            <Outlet />
          </Box>
        </>
      )}
    </Box>
  );
}
