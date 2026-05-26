import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Paper, Typography, TextField, Button, CircularProgress, Alert,
  InputAdornment, IconButton,
} from "@mui/material";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../../../context/AuthContext";

type Step = "credentials" | "totp" | "setup";

export function LoginPage() {
  const { signIn, verify2fa, completeFirstSetup } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [code, setCode] = useState("");
  const [preAuthToken, setPreAuthToken] = useState("");
  const [otpauth, setOtpauth] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn(email, senha);
      if ("requires2fa_setup" in result && result.requires2fa_setup) {
        setPreAuthToken(result.pre_auth_token);
        setOtpauth(result.otpauth);
        setStep("setup");
      } else if ("requires2fa" in result && result.requires2fa) {
        setPreAuthToken(result.pre_auth_token);
        setStep("totp");
      } else {
        navigate("/");
      }
    } catch {
      setError("E-mail ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await verify2fa(preAuthToken, code);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Código inválido.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFirstSetup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await completeFirstSetup(preAuthToken, code);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Código inválido.");
    } finally {
      setLoading(false);
    }
  }

  function backToCredentials() {
    setStep("credentials");
    setCode("");
    setError("");
    setPreAuthToken("");
    setOtpauth("");
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
      <Box sx={{ width: "100%", maxWidth: step === "setup" ? 400 : 360, px: 2 }}>
        {/* Logo */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 6, justifyContent: "center" }}>
          <Box sx={{ width: 36, height: 36, bgcolor: "primary.main", borderRadius: 1.5, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Typography sx={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>D</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>DriveOn</Typography>
            <Typography sx={{ fontSize: 11, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em" }}>Admin</Typography>
          </Box>
        </Box>

        <Paper sx={{ p: 3, borderRadius: 2 }}>

          {/* Step: credenciais */}
          {step === "credentials" && (
            <>
              <Typography variant="h6" sx={{ mb: 0.5, fontSize: 16 }}>Entrar no painel</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: 13 }}>
                Acesso restrito a administradores do sistema.
              </Typography>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <Box component="form" onSubmit={handleCredentials} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus fullWidth size="small" />
                <TextField
                  label="Senha"
                  type={showSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required fullWidth size="small"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowSenha((v) => !v)} edge="end">
                            {showSenha ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button type="submit" variant="contained" fullWidth disabled={loading} sx={{ mt: 0.5 }}>
                  {loading ? <CircularProgress size={16} color="inherit" /> : "Entrar"}
                </Button>
              </Box>
            </>
          )}

          {/* Step: código TOTP (2FA já ativo) */}
          {step === "totp" && (
            <>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                <Box sx={{ width: 36, height: 36, bgcolor: "#f3f4f6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <LockRoundedIcon fontSize="small" sx={{ color: "#374151" }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 15, fontWeight: 600 }}>Verificação em duas etapas</Typography>
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Abra o Google Authenticator</Typography>
                </Box>
              </Box>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <Box component="form" onSubmit={handleTotp} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField
                  label="Código de 6 dígitos"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required fullWidth autoFocus size="small"
                  inputProps={{ inputMode: "numeric", maxLength: 6 }}
                  helperText="Digite o código gerado pelo Google Authenticator"
                />
                <Button type="submit" variant="contained" fullWidth disabled={loading || code.length !== 6}>
                  {loading ? <CircularProgress size={16} color="inherit" /> : "Verificar"}
                </Button>
                <Button size="small" onClick={backToCredentials} sx={{ color: "text.secondary" }}>
                  Voltar ao login
                </Button>
              </Box>
            </>
          )}

          {/* Step: setup obrigatório de 2FA (primeiro acesso) */}
          {step === "setup" && (
            <>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                <Box sx={{ width: 36, height: 36, bgcolor: "#f3f4f6", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <QrCode2RoundedIcon fontSize="small" sx={{ color: "#374151" }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 15, fontWeight: 600 }}>Configure o Google Authenticator</Typography>
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Obrigatório para acessar o painel</Typography>
                </Box>
              </Box>

              <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
                Abra o <strong>Google Authenticator</strong>, toque em <strong>+</strong> → <strong>Ler QR Code</strong> e escaneie:
              </Typography>

              <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
                <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "#fff", display: "inline-flex" }}>
                  <QRCodeSVG value={otpauth} size={180} />
                </Box>
              </Box>

              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              <Box component="form" onSubmit={handleFirstSetup} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField
                  label="Código de 6 dígitos"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required fullWidth autoFocus size="small"
                  inputProps={{ inputMode: "numeric", maxLength: 6 }}
                  helperText="Digite o código gerado pelo app para confirmar"
                />
                <Button type="submit" variant="contained" fullWidth disabled={loading || code.length !== 6}>
                  {loading ? <CircularProgress size={16} color="inherit" /> : "Confirmar e entrar"}
                </Button>
                <Button size="small" onClick={backToCredentials} sx={{ color: "text.secondary" }}>
                  Voltar ao login
                </Button>
              </Box>
            </>
          )}

        </Paper>
      </Box>
    </Box>
  );
}
