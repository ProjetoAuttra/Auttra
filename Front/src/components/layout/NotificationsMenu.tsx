import * as React from "react";
import {
  Avatar,
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  ListItemAvatar,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import RequestQuoteRoundedIcon from "@mui/icons-material/RequestQuoteRounded";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { listarNotificacoes, type AppNotification, type NotificationSeverity, type NotificationType } from "../../modules/notificacoes/api";

const severityColor: Record<NotificationSeverity, string> = {
  danger: "#dc2626",
  warning: "#d97706",
  info: "#2563eb",
  success: "#059669",
};

const typeIcon: Record<NotificationType, React.ReactNode> = {
  agenda: <EventRoundedIcon />,
  financeiro: <PaymentsRoundedIcon />,
  estoque: <Inventory2RoundedIcon />,
  ordens: <BuildRoundedIcon />,
  orcamentos: <RequestQuoteRoundedIcon />,
};

function readStorageKey(userId?: number, oficinaId?: number) {
  return `driveon:notifications:read:${userId ?? "anon"}:${oficinaId ?? 0}`;
}

function loadReadIds(key: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function NotificationsMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [notifications, setNotifications] = React.useState<AppNotification[]>([]);
  const [readIds, setReadIds] = React.useState<string[]>([]);

  const storageKey = React.useMemo(
    () => readStorageKey(user?.id, user?.oficina_id ?? user?.oficinaId),
    [user?.id, user?.oficina_id, user?.oficinaId],
  );

  const unreadCount = notifications.filter((notification) => !readIds.includes(notification.id)).length;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await listarNotificacoes();
      setNotifications(data);
    } catch (err) {
      console.error("Erro ao carregar notificacoes", err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setReadIds(loadReadIds(storageKey));
  }, [storageKey]);

  React.useEffect(() => {
    load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const persistReadIds = (ids: string[]) => {
    const next = Array.from(new Set(ids));
    setReadIds(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const markAllAsRead = () => {
    persistReadIds([...readIds, ...notifications.map((notification) => notification.id)]);
  };

  const openNotification = (notification: AppNotification) => {
    persistReadIds([...readIds, notification.id]);
    setAnchorEl(null);
    navigate(notification.rota);
  };

  return (
    <>
      <Tooltip title="Notificacoes">
        <IconButton
          size="small"
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            border: (t) => `1px solid ${t.palette.divider}`,
            color: "text.secondary",
            bgcolor: "#FFFFFF",
            "&:hover": {
              bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
              color: "primary.main",
            },
          }}
        >
          <Badge badgeContent={unreadCount} color="error" invisible={unreadCount === 0}>
            <NotificationsRoundedIcon sx={{ fontSize: 20 }} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        PaperProps={{
          sx: {
            mt: 1,
            width: { xs: "calc(100vw - 24px)", sm: 390 },
            maxWidth: 390,
            borderRadius: 2,
            border: (t) => `1px solid ${t.palette.divider}`,
            boxShadow: "0 16px 40px rgba(15,23,42,0.14)",
            overflow: "hidden",
          },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
          <Box>
            <Typography variant="subtitle2" fontWeight={800}>
              Notificacoes
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {unreadCount > 0 ? `${unreadCount} alerta${unreadCount > 1 ? "s" : ""} novo${unreadCount > 1 ? "s" : ""}` : "Tudo visto por aqui"}
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.5} alignItems="center">
            {loading ? (
              <CircularProgress size={18} />
            ) : (
              <Tooltip title="Atualizar">
                <IconButton size="small" onClick={load}>
                  <RefreshRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Button
              size="small"
              startIcon={<DoneAllRoundedIcon sx={{ fontSize: "16px !important" }} />}
              onClick={markAllAsRead}
              disabled={notifications.length === 0 || unreadCount === 0}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1 }}
            >
              Lidas
            </Button>
          </Stack>
        </Stack>

        <Divider />

        {notifications.length === 0 ? (
          <Box sx={{ px: 3, py: 4, textAlign: "center" }}>
            <Typography variant="body2" fontWeight={700}>
              Nenhum alerta agora
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Agenda, financeiro, estoque, O.S e orcamentos estao sem pendencias.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 430, overflowY: "auto", py: 0.5 }}>
            {notifications.map((notification) => {
              const color = severityColor[notification.severidade];
              const isRead = readIds.includes(notification.id);

              return (
                <MenuItem
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                  sx={{
                    alignItems: "flex-start",
                    gap: 1.25,
                    px: 2,
                    py: 1.25,
                    whiteSpace: "normal",
                    bgcolor: isRead ? "transparent" : alpha(color, 0.045),
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 0 }}>
                    <Avatar
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: 1.25,
                        bgcolor: alpha(color, 0.12),
                        color,
                        "& svg": { fontSize: 18 },
                      }}
                    >
                      {typeIcon[notification.tipo]}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight={800} sx={{ flex: 1, minWidth: 0 }}>
                          {notification.titulo}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
                          {formatDate(notification.createdAt)}
                        </Typography>
                        {!isRead && <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />}
                      </Stack>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                        {notification.descricao}
                      </Typography>
                    }
                    sx={{ my: 0 }}
                  />
                </MenuItem>
              );
            })}
          </Box>
        )}
      </Menu>
    </>
  );
}
