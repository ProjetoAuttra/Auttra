import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Box, Typography, List, ListItemButton, ListItemIcon, ListItemText,
  IconButton, Tooltip, Divider, Avatar,
} from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";
import { useAuth } from "../context/AuthContext";
import { MinhaContaDialog } from "../modules/auth/dialog/MinhaContaDialog";

const SIDEBAR_WIDTH = 220;

const navItems = [
  { label: "Dashboard", icon: <DashboardRoundedIcon fontSize="small" />, to: "/" },
  { label: "Oficinas", icon: <BusinessRoundedIcon fontSize="small" />, to: "/oficinas" },
  { label: "Administradores", icon: <AdminPanelSettingsRoundedIcon fontSize="small" />, to: "/admins" },
];

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [contaOpen, setContaOpen] = useState(false);

  function handleSignOut() {
    signOut();
    navigate("/login");
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Sidebar */}
      <Box
        component="nav"
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          bgcolor: "background.paper",
          borderRight: "1px solid",
          borderColor: "divider",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          bottom: 0,
        }}
      >
        {/* Logo */}
        <Box sx={{ px: 2.5, py: 2.5, display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 28, height: 28, bgcolor: "#111827", borderRadius: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
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

        {/* Nav */}
        <Box sx={{ px: 1.5, py: 1.5, flex: 1 }}>
          <Typography
            sx={{ fontSize: 10, fontWeight: 600, color: "text.secondary",
              textTransform: "uppercase", letterSpacing: "0.08em", px: 1, mb: 0.5 }}
          >
            Menu
          </Typography>
          <List dense disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
            {navItems.map((item) => (
              <ListItemButton
                key={item.to}
                component={NavLink}
                to={item.to}
                end={item.to === "/"}
                sx={{
                  py: 0.75, px: 1,
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

        {/* Footer */}
        <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar sx={{ width: 28, height: 28, bgcolor: "#e5e7eb", color: "#374151", fontSize: 12, fontWeight: 700 }}>
            {user?.nome?.[0]?.toUpperCase() ?? "A"}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.nome}
            </Typography>
            <Typography sx={{ fontSize: 11, color: "text.secondary" }}>Sistema</Typography>
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
      </Box>

      <MinhaContaDialog open={contaOpen} onClose={() => setContaOpen(false)} />

      {/* Main content */}
      <Box sx={{ flex: 1, ml: `${SIDEBAR_WIDTH}px`, minHeight: "100vh" }}>
        <Outlet />
      </Box>
    </Box>
  );
}
