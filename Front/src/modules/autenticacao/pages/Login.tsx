import { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  Alert,
  Collapse,
  MenuItem,
  Dialog,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { paths } from "../../../routes/paths";
import logo from "../../../assets/logo.png";
import api from "../../../api/api";

// Cores da marca.
const BLUE_MAIN = "#2563EB";
const BLUE_LIGHT = "#60A5FA";
const BLUE_DARK = "#1E3A8A";
const TEAL = "#0F766E";
const INK = "#111827";

// Estilo compartilhado dos campos.
const fieldSx = {
  "& .MuiInputLabel-root": {
    color: alpha(INK, 0.56),
    fontSize: 14,
  },
  "& .MuiInputLabel-root.Mui-focused": { color: BLUE_MAIN },
  "& .MuiOutlinedInput-root": {
    color: INK,
    fontSize: 14,
    borderRadius: 2,
    bgcolor: "#fff",
    "& fieldset": { borderColor: "#D9E2EC" },
    "&:hover fieldset": { borderColor: alpha(BLUE_MAIN, 0.5) },
    "&.Mui-focused fieldset": { borderColor: BLUE_MAIN },
  },
} as const;


export default function Login() {
  const nav = useNavigate();
  const { signIn, selectOffice } = useAuth();

  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [selectionToken, setSelectionToken] = useState("");
  const [offices, setOffices] = useState<{ id: number; nome: string; perfil: string }[]>([]);
  const [officeId, setOfficeId] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const token =
      localStorage.getItem("driveon:token") ??
      sessionStorage.getItem("driveon:token");
    if (token) nav(paths.root, { replace: true });
  }, [nav]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) { setError("Preencha o e-mail e a senha."); return; }
    try {
      setLoading(true);
      const result = await signIn(email, password, remember);
      if (result.requiresOfficeSelection) {
        setSelectionToken(result.selectionToken);
        setOffices(result.oficinas);
        setOfficeId(String(result.oficinas[0]?.id ?? ""));
        return;
      }
      nav(paths.root, { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleOfficeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!officeId) { setError("Selecione uma unidade."); return; }
    try {
      setLoading(true);
      await selectOffice(selectionToken, Number(officeId), remember);
      nav(paths.root, { replace: true });
    } catch (err: any) {
      setError(err.message || "Nao foi possivel selecionar a unidade.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async () => {
    const targetEmail = (forgotEmail || email).trim();
    setForgotError(null);
    setForgotMessage(null);

    if (!targetEmail) {
      setForgotError("Informe o e-mail cadastrado.");
      return;
    }

    try {
      setForgotLoading(true);
      const { data } = await api.post("/auth/forgot-password", { email: targetEmail });
      setForgotMessage(data?.message ?? "Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.");
    } catch (err: any) {
      setForgotError(err?.response?.data?.message ?? "Não foi possível enviar o e-mail de recuperação.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        bgcolor: "#F6F8FB",
        backgroundImage: `
          linear-gradient(135deg, ${alpha(BLUE_DARK, 0.08)} 0%, transparent 34%),
          linear-gradient(315deg, ${alpha(TEAL, 0.10)} 0%, transparent 38%)
        `,
      }}
    >


      {/* Gradientes de atmosfera */}
      <Box
        sx={{
          position: "absolute",
          inset: { xs: 16, md: 28 },
          border: "1px solid #D9E2EC",
          borderRadius: 3,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(255,255,255,0.38) 100%)",
          zIndex: 0,
        }}
      />

      {/* Grid de pontos */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(circle at 50% 0%, ${alpha(BLUE_MAIN, 0.12)} 0%, transparent 34%)`,
          zIndex: 0,
        }}
      />

      {/* Card central */}
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 440,
          mx: 3,
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(18px)",
          transition: "opacity 0.55s ease, transform 0.55s ease",
        }}
      >
        {/* Logo */}
        <Stack alignItems="center" mb={5}>
          <Box
            component="img"
            src={logo}
            alt="Auttra"
            sx={{
              height: 62,
              width: "auto",
              objectFit: "contain",
            }}
          />
        </Stack>

        {/* Vidro */}
        <Box
          sx={{
            bgcolor: "#FFFFFF",
            border: "1px solid #D9E2EC",
            borderRadius: 2,
            px: { xs: 3.5, sm: 5 },
            pt: 4.5,
            pb: 5,
            boxShadow: "0 24px 70px rgba(15, 23, 42, 0.12)",
          }}
        >
          {/* Titulo */}
          <Stack spacing={0.75} mb={4}>
            <Typography
              sx={{
                fontSize: 22,
                fontWeight: 800,
                color: INK,
                letterSpacing: 0,
                lineHeight: 1.2,
              }}
            >
              Entrar no sistema
            </Typography>
            <Typography sx={{ fontSize: 14, color: alpha(INK, 0.6) }}>
              Acesse sua conta para continuar
            </Typography>
          </Stack>

          <form onSubmit={selectionToken ? handleOfficeSubmit : handleSubmit} noValidate>
            <Stack spacing={2.5}>
              {selectionToken ? (
                <TextField
                  select
                  label="Unidade"
                  fullWidth
                  value={officeId}
                  onChange={(e) => { setOfficeId(e.target.value); setError(null); }}
                  sx={fieldSx}
                >
                  {offices.map((office) => (
                    <MenuItem key={office.id} value={office.id}>
                      {office.nome}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <>
                  <TextField
                    label="E-mail"
                    type="email"
                    fullWidth
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    autoComplete="email"
                    autoFocus
                    error={!!error}
                    helperText={error || undefined}
                    sx={fieldSx}
                  />

                  <TextField
                    label="Senha"
                    type={show ? "text" : "password"}
                    fullWidth
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    autoComplete="current-password"
                    error={!!error}
                    helperText={error || undefined}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlinedIcon sx={{ fontSize: 17, color: alpha(INK, 0.38) }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShow((s) => !s)}
                            edge="end" size="small" tabIndex={-1}
                            sx={{ color: alpha(INK, 0.48) }}
                          >
                            {show
                              ? <VisibilityOff sx={{ fontSize: 17 }} />
                              : <Visibility sx={{ fontSize: 17 }} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={fieldSx}
                  />

                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={remember}
                          onChange={(e) => setRemember(e.target.checked)}
                          size="small"
                          sx={{
                            color: alpha(INK, 0.38),
                            "&.Mui-checked": { color: BLUE_MAIN },
                            p: 0.5,
                          }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: 13, color: alpha(INK, 0.62) }}>
                          Lembrar-me
                        </Typography>
                      }
                    />
                    <Button
                      variant="text" size="small"
                      onClick={() => {
                        setForgotEmail(email);
                        setForgotMessage(null);
                        setForgotError(null);
                        setForgotOpen(true);
                      }}
                      sx={{
                        textTransform: "none", fontWeight: 500, fontSize: 13,
                        color: BLUE_MAIN, p: 0, minWidth: 0,
                        "&:hover": { color: BLUE_DARK, bgcolor: "transparent" },
                      }}
                    >
                      Esqueceu a senha?
                    </Button>
                  </Stack>
                </>
              )}

              {selectionToken && (
                <Collapse in={!!error}>
                  <Alert
                    severity="error"
                    onClose={() => setError(null)}
                    sx={{
                      borderRadius: 2,
                      bgcolor: alpha("#ef4444", 0.12),
                      color: "#fca5a5",
                      border: `1px solid ${alpha("#ef4444", 0.2)}`,
                      "& .MuiAlert-icon": { color: "#fca5a5" },
                      py: 0.5, fontSize: 13,
                    }}
                  >
                    {error}
                  </Alert>
                </Collapse>
              )}

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading}
                endIcon={!loading && <ArrowForwardRoundedIcon />}
                disableElevation
                sx={{
                  height: 50,
                  borderRadius: 2,
                  fontWeight: 700,
                  fontSize: 14,
                  textTransform: "none",
                  mt: 0.5,
                  background: `linear-gradient(135deg, ${BLUE_MAIN} 0%, ${BLUE_DARK} 72%, ${TEAL} 100%)`,
                  color: "#fff",
                  boxShadow: `0 4px 20px ${alpha(BLUE_MAIN, 0.45)}`,
                  transition: "opacity 0.2s, transform 0.15s, box-shadow 0.2s",
                  "&:hover": {
                    background: `linear-gradient(135deg, ${BLUE_LIGHT} 0%, ${BLUE_MAIN} 68%, ${TEAL} 100%)`,
                    transform: "translateY(-1px)",
                    boxShadow: `0 6px 28px ${alpha(BLUE_LIGHT, 0.45)}`,
                  },
                  "&:active": { transform: "translateY(0)", boxShadow: "none" },
                  "&.Mui-disabled": {
                    background: alpha(BLUE_MAIN, 0.22),
                    color: alpha("#fff", 0.35),
                  },
                }}
              >
                {loading ? "Entrando..." : selectionToken ? "Continuar" : "Entrar"}
              </Button>
            </Stack>
          </form>
        </Box>

        <Typography
          sx={{
            textAlign: "center",
            mt: 3.5,
            fontSize: 12,
            color: alpha(INK, 0.42),
          }}
        >
          © {new Date().getFullYear()} Auttra · Sistema de Gestao de Oficina
        </Typography>
      </Box>

      <Dialog open={forgotOpen} onClose={() => setForgotOpen(false)} maxWidth="xs" fullWidth>
        <DialogContent sx={{ pt: 3.5, pb: 2 }}>
          <Typography variant="subtitle1" fontWeight={800} mb={1}>
            Recuperar senha
          </Typography>
          <Stack spacing={2} mt={2}>
            <Typography variant="body2" color="text.secondary">
              Informe o e-mail da sua conta para receber um link seguro de redefinição.
            </Typography>
            {forgotError && <Alert severity="error">{forgotError}</Alert>}
            {forgotMessage && <Alert severity="success">{forgotMessage}</Alert>}
            <TextField
              label="E-mail"
              type="email"
              fullWidth
              value={forgotEmail}
              onChange={(event) => setForgotEmail(event.target.value)}
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setForgotOpen(false)} variant="outlined" disableElevation size="small"
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}>
            Cancelar
          </Button>
          <Button onClick={handleForgotSubmit} variant="contained" disableElevation size="small" disabled={forgotLoading}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}>
            {forgotLoading ? "Enviando..." : "Enviar link"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
