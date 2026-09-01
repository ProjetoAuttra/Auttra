import {
  AppBar,
  Toolbar,
  Box,
  Avatar,
  IconButton,
  Paper,
  InputBase,
  Stack,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  CircularProgress,
  Typography,
  Button,
  TextField,
  InputAdornment,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useSidebar } from "../../context/SidebarContext";
import api from "../../api/api";
import { useNavigate } from "react-router-dom";
import NotificationsMenu from "./NotificationsMenu";
import EmpresaModal from "./EmpresaModal";
import MeuPerfilModal from "./MeuPerfilModal";
import BrandLogoPlaceholder from "./BrandLogoPlaceholder";
import { AppDialog, AppDialogActions, AppDialogContent } from "../common/AppDialog";

const CARGO_LABEL: Record<string, string> = {
  administrador: "Administrador",
  gestoroficina: "Gestor",
  gerente: "Gerente",
  atendente: "Atendente",
  mecanico: "Mecânico",
  funcionario: "Funcionário",
  cliente: "Cliente",
  sistema: "Sistema",
};

export default function AppTopbar({
  onMenuClick,
}: {
  onMenuClick?: () => void;
}) {
  const { user, signOut } = useAuth();
  const { success, error, warning } = useToast();
  const { collapsed, toggleCollapsed } = useSidebar();
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [empresaOpen, setEmpresaOpen] = useState(false);
  const [meuPerfilOpen, setMeuPerfilOpen] = useState(false);
  const [trocaSenhaOpen, setTrocaSenhaOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [senhaForm, setSenhaForm] = useState({ senha_atual: "", nova_senha: "", confirmar: "" });
  const [savingSenha, setSavingSenha] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setResults([]);
      setSearchOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoadingSearch(true);
        const { data } = await api.get("/clientes", { params: { search: searchTerm } });
        setResults(data);
        setSearchOpen(true);
      } catch (err) {
        console.error("Erro ao buscar clientes", err);
      } finally {
        setLoadingSearch(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleLogout = () => {
    signOut();
    window.location.href = "/login";
  };

  const handleTrocarSenha = async () => {
    if (!senhaForm.senha_atual) {
      warning("Informe a senha atual.");
      return;
    }
    if (senhaForm.nova_senha.length < 6) {
      warning("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (senhaForm.nova_senha !== senhaForm.confirmar) {
      warning("A confirmação não corresponde à nova senha.");
      return;
    }
    setSavingSenha(true);
    try {
      await api.post("/auth/change-password", {
        senha_atual: senhaForm.senha_atual,
        nova_senha: senhaForm.nova_senha,
      });
      success("Senha alterada com sucesso.");
      setTrocaSenhaOpen(false);
      setSenhaForm({ senha_atual: "", nova_senha: "", confirmar: "" });
    } catch (err: any) {
      error(err?.response?.data?.message ?? "Não foi possível alterar a senha.");
    } finally {
      setSavingSenha(false);
    }
  };

  const nomeUsuario = user?.nome || "Usuário";
  const empresaLabel = user?.oficina_nome?.trim() || "Empresa nao informada";
  const empresaLetter = empresaLabel[0]?.toUpperCase() || "D";
  const empresaLogoUrl = user?.oficina_logo_url ?? null;
  const cargoLabel =
    user?.perfilAcessoNome ??
    CARGO_LABEL[(user?.tipo ?? "").toLowerCase()] ??
    user?.tipo ??
    "Usuário";

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          top: 0,
          left: 0,
          right: 0,
          width: "100%",
          zIndex: (t) => t.zIndex.drawer + 1,
          bgcolor: "primary.main",
          borderBottom: "none",
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
          color: "#FFFFFF",
        }}
      >
        <Toolbar sx={{ px: { xs: 1.5, sm: 2.5, md: 4 }, position: "relative", gap: 1.5 }}>
          <IconButton
            onClick={onMenuClick}
            sx={{
              display: { xs: "inline-flex", md: "none" },
              mr: 1,
              width: 38,
              height: 38,
              borderRadius: 1.5,
              border: "1px solid rgba(255,255,255,0.35)",
              color: "#FFFFFF",
              "&:hover": { bgcolor: "rgba(255,255,255,0.12)" },
            }}
          >
            <MenuRoundedIcon />
          </IconButton>

          <BrandLogoPlaceholder />

          <IconButton
            onClick={toggleCollapsed}
            size="small"
            sx={{
              display: { xs: "none", md: "inline-flex" },
              mr: 1.5,
              width: 34,
              height: 34,
              borderRadius: 1.5,
              border: "1px solid rgba(255,255,255,0.35)",
              color: "#FFFFFF",
              flexShrink: 0,
              "&:hover": { bgcolor: "rgba(255,255,255,0.12)" },
            }}
          >
            {collapsed ? <ChevronRightRoundedIcon fontSize="small" /> : <ChevronLeftRoundedIcon fontSize="small" />}
          </IconButton>

          <Box
            sx={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              minWidth: 0,
            }}
          >
          <Box
            ref={searchRef}
            sx={{
              position: "static",
              width: { xs: "min(58vw, 320px)", sm: 340, md: 400, lg: 440 },
              maxWidth: { xs: 320, md: 440 },
              zIndex: 1,
            }}
          >
            <Paper
              elevation={0}
              sx={{
                display: "flex",
                alignItems: "center",
                px: { xs: 1.5, sm: 2 },
                py: { xs: 0.85, sm: 1.05 },
                borderRadius: "12px",
                border: "1px solid transparent",
                bgcolor: "rgba(255,255,255,0.16)",
                transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s",
                "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
                "&:focus-within": {
                  bgcolor: "rgba(255,255,255,0.22)",
                  borderColor: "rgba(255,255,255,0.5)",
                  boxShadow: "0 0 0 3px rgba(255,255,255,0.18)",
                },
              }}
            >
              {loadingSearch ? (
                <CircularProgress size={18} sx={{ mr: 1.5, flexShrink: 0, color: "#FFFFFF" }} />
              ) : (
                <SearchRoundedIcon
                  sx={{
                    fontSize: 21,
                    mr: 1.5,
                    flexShrink: 0,
                    color: "rgba(255,255,255,0.85)",
                    transition: "color 0.2s",
                  }}
                />
              )}
              <InputBase
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar cliente..."
                sx={{
                  flex: 1,
                  fontSize: { xs: 14, sm: 15 },
                  color: "#FFFFFF",
                  "& input": { padding: 0, "&::placeholder": { color: "rgba(255,255,255,0.7)", opacity: 1 } },
                }}
                onFocus={() => results.length > 0 && setSearchOpen(true)}
              />
              {searchTerm && (
                <IconButton
                  size="small"
                  onClick={() => { setSearchTerm(""); setSearchOpen(false); }}
                  sx={{ ml: 0.5, p: 0.25 }}
                >
                  <Box sx={{ fontSize: 16, lineHeight: 1, color: "rgba(255,255,255,0.75)" }}>x</Box>
                </IconButton>
              )}
            </Paper>

            {searchOpen && (
              <Paper
                elevation={4}
                sx={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  right: 0,
                  zIndex: 1300,
                  borderRadius: 2,
                  overflow: "hidden",
                  border: (t) => `1px solid ${t.palette.divider}`,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                }}
              >
                {results.length === 0 ? (
                  <Box sx={{ p: 2.5, textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      Nenhum cliente encontrado para "{searchTerm}"
                    </Typography>
                  </Box>
                ) : (
                  results.map((c) => (
                    <MenuItem
                      key={c.id}
                      onClick={() => { setSearchOpen(false); setSearchTerm(""); navigate(`/clientes/${c.id}`); }}
                      sx={{ py: 1.25, px: 2 }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar sx={{ width: 30, height: 30, fontSize: 13, fontWeight: 700, bgcolor: "primary.main" }}>
                          {(c.nome ?? "?")[0].toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{c.nome}</Typography>
                          {c.telefone && <Typography variant="caption" color="text.secondary">{c.telefone}</Typography>}
                        </Box>
                      </Stack>
                    </MenuItem>
                  ))
                )}
              </Paper>
            )}
          </Box>
          </Box>

          <Stack direction="row" alignItems="center" spacing={0.75}>
            <NotificationsMenu />

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 24, alignSelf: "center", borderColor: "rgba(255,255,255,0.3)" }} />

            <Box
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                px: 1,
                py: 0.75,
                borderRadius: 1.5,
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                cursor: "pointer",
                transition: "background 0.2s",
                "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
              }}
            >
              <Avatar src={empresaLogoUrl ?? undefined} sx={{ width: 30, height: 30, fontSize: 13, fontWeight: 800, bgcolor: "rgba(255,255,255,0.25)", color: "#FFFFFF" }}>
                {empresaLetter}
              </Avatar>

              <Box sx={{ lineHeight: 1, display: { xs: "none", sm: "block" } }}>
                <Typography variant="body2" fontWeight={700} lineHeight={1.3} noWrap maxWidth={160} sx={{ color: "#FFFFFF" }}>
                  {empresaLabel}
                </Typography>
                <Typography variant="caption" lineHeight={1.2} noWrap maxWidth={160} component="div" sx={{ color: "rgba(255,255,255,0.75)" }}>
                  {nomeUsuario}
                </Typography>
              </Box>

              <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.75)", ml: 0.25 }} />
            </Box>
          </Stack>

          <Menu
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={() => setAnchorEl(null)}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            PaperProps={{
              sx: {
                mt: 1,
                borderRadius: 2,
                border: (t) => `1px solid ${t.palette.divider}`,
                boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                minWidth: 220,
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: (t) => `1px solid ${t.palette.divider}` }}>
              <Typography variant="body2" fontWeight={700} noWrap>{nomeUsuario}</Typography>
              <Typography variant="caption" color="text.secondary" display="block" noWrap>{empresaLabel}</Typography>
              <Typography variant="caption" color="text.secondary" display="block" noWrap>{cargoLabel}</Typography>
            </Box>

            <MenuItem onClick={() => { setAnchorEl(null); setMeuPerfilOpen(true); }} sx={{ py: 1.25, mt: 0.5 }}>
              <ListItemIcon><PersonRoundedIcon fontSize="small" /></ListItemIcon>
              <Typography variant="body2">Meu perfil</Typography>
            </MenuItem>

            <MenuItem
              onClick={() => { setAnchorEl(null); setEmpresaOpen(true); }}
              sx={{ py: 1.25 }}
            >
              <ListItemIcon><BusinessRoundedIcon fontSize="small" /></ListItemIcon>
              <Typography variant="body2">Minha empresa</Typography>
            </MenuItem>

            <MenuItem
              onClick={() => { setAnchorEl(null); setTrocaSenhaOpen(true); }}
              sx={{ py: 1.25 }}
            >
              <ListItemIcon><KeyRoundedIcon fontSize="small" /></ListItemIcon>
              <Typography variant="body2">Trocar senha</Typography>
            </MenuItem>

            <Divider sx={{ my: 0.5 }} />

            <MenuItem
              onClick={() => {
                setAnchorEl(null);
                setLogoutConfirmOpen(true);
              }}
              sx={{ py: 1.25, color: "error.main", mb: 0.5 }}
            >
              <ListItemIcon><LogoutRoundedIcon fontSize="small" color="error" /></ListItemIcon>
              <Typography variant="body2" color="error">Sair</Typography>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <EmpresaModal open={empresaOpen} onClose={() => setEmpresaOpen(false)} />
      <MeuPerfilModal
        open={meuPerfilOpen}
        onClose={() => setMeuPerfilOpen(false)}
        onChangePassword={() => setTrocaSenhaOpen(true)}
      />

      <AppDialog
        open={trocaSenhaOpen}
        onClose={() => { setTrocaSenhaOpen(false); setSenhaForm({ senha_atual: "", nova_senha: "", confirmar: "" }); }}
        onCloseClick={() => { setTrocaSenhaOpen(false); setSenhaForm({ senha_atual: "", nova_senha: "", confirmar: "" }); }}
        closeOnBackdrop={false}
        closeOnEscape={false}
        maxWidth="xs"
        title="Trocar senha"
      >
        <AppDialogContent>
          <Stack spacing={2}>
            <TextField
              label="Senha atual"
              type="password"
              fullWidth
              value={senhaForm.senha_atual}
              onChange={(e) => setSenhaForm((p) => ({ ...p, senha_atual: e.target.value }))}
              InputProps={{ startAdornment: <InputAdornment position="start"><LockRoundedIcon fontSize="small" /></InputAdornment> }}
            />
            <TextField
              label="Nova senha"
              type="password"
              fullWidth
              value={senhaForm.nova_senha}
              onChange={(e) => setSenhaForm((p) => ({ ...p, nova_senha: e.target.value }))}
              helperText="Mínimo 6 caracteres"
              InputProps={{ startAdornment: <InputAdornment position="start"><LockRoundedIcon fontSize="small" /></InputAdornment> }}
            />
            <TextField
              label="Confirmar nova senha"
              type="password"
              fullWidth
              value={senhaForm.confirmar}
              onChange={(e) => setSenhaForm((p) => ({ ...p, confirmar: e.target.value }))}
              InputProps={{ startAdornment: <InputAdornment position="start"><LockRoundedIcon fontSize="small" /></InputAdornment> }}
            />
          </Stack>
        </AppDialogContent>

        <AppDialogActions>
          <Button
            onClick={() => { setTrocaSenhaOpen(false); setSenhaForm({ senha_atual: "", nova_senha: "", confirmar: "" }); }}
            variant="outlined"
            sx={{ borderRadius: 999 }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleTrocarSenha}
            variant="contained"
            disableElevation
            disabled={savingSenha}
            sx={{ borderRadius: 999, fontWeight: 700 }}
          >
            {savingSenha ? <CircularProgress size={18} /> : "Salvar"}
          </Button>
        </AppDialogActions>
      </AppDialog>

      <AppDialog
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onCloseClick={() => setLogoutConfirmOpen(false)}
        closeOnBackdrop={false}
        closeOnEscape={false}
        maxWidth="xs"
        title="Sair do sistema"
        icon={<LogoutRoundedIcon />}
        variant="entity"
      >
        <AppDialogContent>
          <Typography variant="body2" color="text.secondary">
            Tem certeza que deseja sair da sua conta?
          </Typography>
        </AppDialogContent>

        <AppDialogActions>
          <Button
            onClick={() => setLogoutConfirmOpen(false)}
            variant="outlined"
            sx={{ borderRadius: 999 }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleLogout}
            variant="contained"
            color="error"
            disableElevation
            sx={{ borderRadius: 999, fontWeight: 700 }}
          >
            Sair
          </Button>
        </AppDialogActions>
      </AppDialog>
    </>
  );
}
