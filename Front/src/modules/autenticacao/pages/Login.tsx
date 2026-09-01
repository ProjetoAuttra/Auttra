import { useState, useEffect, useRef } from "react";
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
  CircularProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { paths } from "../../../routes/paths";
import logo from "../../../assets/logo.png";
import api, { turnstileSiteKey } from "../../../api/api";
import { brand } from "../../../app/theme";
import TurnstileWidget, { type TurnstileWidgetHandle } from "../../../components/common/TurnstileWidget";

// Cores da marca (mesma fonte do tema global, para nao dessincronizar).
const BLUE_MAIN = brand.primary;
const BLUE_DARK = brand.primaryDark;
const TEAL = brand.teal;
const INK = brand.ink;

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
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailToken, setEmailToken] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
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
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const [capsLockOn, setCapsLockOn] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token =
      localStorage.getItem("driveon:token") ??
      sessionStorage.getItem("driveon:token");
    if (token) nav(paths.root, { replace: true });
  }, [nav]);

  useEffect(() => {
    if (forgotCooldown <= 0) return;
    const timer = setTimeout(() => setForgotCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [forgotCooldown]);

  const resetToEmailStep = () => {
    setStep("email");
    setPassword("");
    setEmailToken("");
    setTurnstileToken("");
    turnstileRef.current?.reset();
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) { setError("Informe seu e-mail."); return; }
    if (!turnstileToken) { setError("Complete a verificação de segurança."); return; }
    try {
      setLoading(true);
      const { data } = await api.post("/auth/verify-email", { email, turnstileToken });
      setEmailToken(data.emailToken);
      setStep("password");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Não foi possível verificar o e-mail.");
      setTurnstileToken("");
      turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password) { setError("Preencha a senha."); return; }
    try {
      setLoading(true);
      const result = await signIn(email, password, remember, emailToken);
      if (result.requiresOfficeSelection) {
        setSelectionToken(result.selectionToken);
        setOffices(result.oficinas);
        setOfficeId(String(result.oficinas[0]?.id ?? ""));
        return;
      }
      nav(paths.root, { replace: true });
    } catch (err: any) {
      if (err?.response?.data?.code === "EMAIL_VERIFICATION_REQUIRED") {
        resetToEmailStep();
        setError("Verificação de segurança expirada. Confirme seu e-mail novamente.");
        return;
      }
      setError(err?.response?.data?.message ?? "Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setSelectionToken("");
    setOffices([]);
    setOfficeId("");
    setError(null);
    resetToEmailStep();
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
      setForgotCooldown(30);
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
              {selectionToken ? "Entrar no sistema" : "Bem-vindo(a) de volta 👋"}
            </Typography>
            <Typography sx={{ fontSize: 14, color: alpha(INK, 0.6) }}>
              {selectionToken
                ? "Acesse sua conta para continuar"
                : step === "email"
                ? "Acesse sua conta Auttra para continuar"
                : "Confirme sua senha para continuar"}
            </Typography>
          </Stack>

          <form onSubmit={selectionToken ? handleOfficeSubmit : step === "email" ? handleVerifyEmail : handleSubmit} noValidate>
            <Stack spacing={2.5}>
              {selectionToken ? (
                <>
                  <Button
                    onClick={handleBackToLogin}
                    startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 16 }} />}
                    sx={{
                      alignSelf: "flex-start",
                      textTransform: "none", fontWeight: 500, fontSize: 13,
                      color: alpha(INK, 0.6), p: 0, minWidth: 0,
                      "&:hover": { color: BLUE_MAIN, bgcolor: "transparent" },
                    }}
                  >
                    Voltar
                  </Button>
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
                </>
              ) : step === "email" ? (
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
                    sx={fieldSx}
                  />

                  <TurnstileWidget
                    ref={turnstileRef}
                    siteKey={turnstileSiteKey}
                    onVerify={(token) => { setTurnstileToken(token); setError(null); }}
                    onExpire={() => setTurnstileToken("")}
                    onError={() => setTurnstileToken("")}
                  />
                </>
              ) : (
                <>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography sx={{ fontSize: 13, color: alpha(INK, 0.62) }}>
                      Entrando como <b>{email}</b>
                    </Typography>
                    <Button
                      variant="text" size="small"
                      onClick={resetToEmailStep}
                      sx={{
                        textTransform: "none", fontWeight: 500, fontSize: 13,
                        color: BLUE_MAIN, p: 0, minWidth: 0,
                        "&:hover": { color: BLUE_DARK, bgcolor: "transparent" },
                      }}
                    >
                      Trocar e-mail
                    </Button>
                  </Stack>

                  <TextField
                    label="Senha"
                    type={show ? "text" : "password"}
                    fullWidth
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    onKeyUp={(e) => setCapsLockOn(e.getModifierState?.("CapsLock") ?? false)}
                    onBlur={() => setCapsLockOn(false)}
                    autoComplete="current-password"
                    autoFocus
                    error={!!error}
                    helperText={capsLockOn ? "Caps Lock ativado" : undefined}
                    FormHelperTextProps={{ sx: { color: brand.amber } }}
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
                        setForgotCooldown(0);
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

              <Collapse in={!!error}>
                <Alert
                  severity="error"
                  onClose={() => setError(null)}
                  sx={{ borderRadius: 2, py: 0.5, fontSize: 13 }}
                >
                  {error}
                </Alert>
              </Collapse>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading || (!selectionToken && step === "email" && !turnstileToken)}
                startIcon={loading ? <CircularProgress size={16} thickness={5} sx={{ color: "#fff" }} /> : undefined}
                endIcon={!loading && <ArrowForwardRoundedIcon />}
                disableElevation
                sx={{
                  height: 50,
                  borderRadius: "999px",
                  fontWeight: 700,
                  fontSize: 14,
                  textTransform: "none",
                  mt: 0.5,
                  background: BLUE_MAIN,
                  color: "#fff",
                  boxShadow: `0 4px 20px ${alpha(BLUE_MAIN, 0.45)}`,
                  transition: "opacity 0.2s, transform 0.15s, box-shadow 0.2s",
                  "&:hover": {
                    background: BLUE_DARK,
                    transform: "translateY(-1px)",
                    boxShadow: `0 6px 28px ${alpha(BLUE_MAIN, 0.45)}`,
                  },
                  "&:active": { transform: "translateY(0)", boxShadow: "none" },
                  "&.Mui-disabled": {
                    background: alpha(BLUE_MAIN, 0.22),
                    color: alpha("#fff", 0.35),
                  },
                }}
              >
                {loading ? "Entrando..." : selectionToken || step === "email" ? "Continuar" : "Entrar"}
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
              sx={fieldSx}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setForgotOpen(false)} variant="outlined" disableElevation size="small"
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}>
            Cancelar
          </Button>
          <Button onClick={handleForgotSubmit} variant="contained" disableElevation size="small" disabled={forgotLoading || forgotCooldown > 0}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}>
            {forgotLoading ? "Enviando..." : forgotCooldown > 0 ? `Reenviar em ${forgotCooldown}s` : "Enviar link"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
