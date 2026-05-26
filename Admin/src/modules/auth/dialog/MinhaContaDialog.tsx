import React, { useState } from "react";
import {
  Dialog, Box, Typography, IconButton, DialogContent, DialogActions,
  Button, CircularProgress, TextField, Divider, Chip, Alert,
  InputAdornment,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import { QRCodeSVG } from "qrcode.react";
import api from "../../../api/api";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";

type Props = { open: boolean; onClose: () => void };
type Stage = "idle" | "setup-qr" | "setup-confirm" | "disable";

const SENHA_EMPTY = { atual: "", nova: "", confirmar: "" };

export function MinhaContaDialog({ open, onClose }: Props) {
  const { user, refreshMe } = useAuth();
  const { success, error } = useToast();

  const [stage, setStage] = useState<Stage>("idle");
  const [otpauth, setOtpauth] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [senhaForm, setSenhaForm] = useState(SENHA_EMPTY);
  const [senhaLoading, setSenhaLoading] = useState(false);
  const [senhaErr, setSenhaErr] = useState("");
  const [showAtual, setShowAtual] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);

  function reset() {
    setStage("idle");
    setOtpauth("");
    setCode("");
    setErr("");
  }

  function handleClose() {
    reset();
    setSenhaForm(SENHA_EMPTY);
    setSenhaErr("");
    onClose();
  }

  async function handleSetup() {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.post("/auth/2fa/setup");
      setOtpauth(data.otpauth);
      setStage("setup-qr");
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Erro ao iniciar configuração.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    setErr("");
    try {
      await api.post("/auth/2fa/confirm", { code });
      await refreshMe();
      success("2FA ativado com sucesso! Use o Google Authenticator no próximo login.");
      reset();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Código inválido.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    setLoading(true);
    setErr("");
    try {
      await api.delete("/auth/2fa", { data: { code } });
      await refreshMe();
      success("2FA desativado.");
      reset();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Código inválido.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAlterarSenha(e: React.FormEvent) {
    e.preventDefault();
    setSenhaErr("");
    if (senhaForm.nova !== senhaForm.confirmar) {
      setSenhaErr("As senhas não coincidem.");
      return;
    }
    setSenhaLoading(true);
    try {
      await api.post("/auth/senha", { senha_atual: senhaForm.atual, nova_senha: senhaForm.nova });
      success("Senha alterada com sucesso.");
      setSenhaForm(SENHA_EMPTY);
    } catch (e: any) {
      setSenhaErr(e?.response?.data?.message ?? "Erro ao alterar senha.");
    } finally {
      setSenhaLoading(false);
    }
  }

  const totpEnabled = user?.totp_enabled;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="subtitle1">Minha conta</Typography>
        <IconButton size="small" onClick={handleClose}><CloseRoundedIcon fontSize="small" /></IconButton>
      </Box>

      <DialogContent sx={{ pt: 2.5 }}>
        {/* User info */}
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.5 }}>
            Conta
          </Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{user?.nome}</Typography>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{user?.email}</Typography>
        </Box>

        <Divider sx={{ mb: 2.5 }} />

        {/* 2FA section */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
              Autenticação em dois fatores
            </Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              Google Authenticator (TOTP)
            </Typography>
          </Box>
          <Chip
            icon={totpEnabled ? <CheckCircleRoundedIcon sx={{ fontSize: "14px !important" }} /> : undefined}
            label={totpEnabled ? "Ativo" : "Inativo"}
            size="small"
            sx={{
              bgcolor: totpEnabled ? "#f0fdf4" : "#f9fafb",
              color: totpEnabled ? "#16a34a" : "#6b7280",
              fontWeight: 600, fontSize: 11,
            }}
          />
        </Box>

        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

        {/* Idle */}
        {stage === "idle" && (
          <Box>
            {!totpEnabled ? (
              <>
                <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
                  Com o 2FA ativo, além da senha você precisará do código gerado pelo Google Authenticator a cada login.
                </Typography>
                <Button variant="contained" fullWidth onClick={handleSetup} disabled={loading}>
                  {loading ? <CircularProgress size={16} color="inherit" /> : "Ativar 2FA"}
                </Button>
              </>
            ) : (
              <>
                <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
                  O 2FA está ativo na sua conta. Para desativar, confirme com o código atual do Google Authenticator.
                </Typography>
                <Button variant="outlined" fullWidth color="error" onClick={() => setStage("disable")}>
                  Desativar 2FA
                </Button>
              </>
            )}
          </Box>
        )}

        {/* Setup — QR */}
        {stage === "setup-qr" && (
          <Box>
            <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
              Abra o <strong>Google Authenticator</strong>, toque em <strong>+</strong> → <strong>Ler QR Code</strong> e aponte a câmera:
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
              <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "#fff" }}>
                <QRCodeSVG value={otpauth} size={176} />
              </Box>
            </Box>
            <Typography sx={{ fontSize: 12, color: "text.secondary", textAlign: "center", mb: 2 }}>
              Não consegue ler o QR? Insira o código manualmente no app.
            </Typography>
            <Button variant="contained" fullWidth onClick={() => setStage("setup-confirm")}>
              Já escaneei →
            </Button>
          </Box>
        )}

        {/* Setup — Confirm */}
        {stage === "setup-confirm" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
              Digite o código de 6 dígitos gerado pelo Google Authenticator para confirmar a ativação:
            </Typography>
            <TextField
              label="Código de verificação"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoFocus fullWidth size="small"
              inputProps={{ inputMode: "numeric", maxLength: 6 }}
            />
            <Button variant="contained" fullWidth disabled={loading || code.length !== 6} onClick={handleConfirm}>
              {loading ? <CircularProgress size={16} color="inherit" /> : "Confirmar e ativar"}
            </Button>
            <Button size="small" onClick={() => setStage("setup-qr")} sx={{ color: "text.secondary" }}>
              Voltar ao QR Code
            </Button>
          </Box>
        )}

        {/* Disable */}
        {stage === "disable" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
              Digite o código atual do Google Authenticator para desativar o 2FA:
            </Typography>
            <TextField
              label="Código de verificação"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoFocus fullWidth size="small"
              inputProps={{ inputMode: "numeric", maxLength: 6 }}
            />
            <Button variant="outlined" color="error" fullWidth disabled={loading || code.length !== 6} onClick={handleDisable}>
              {loading ? <CircularProgress size={16} color="inherit" /> : "Desativar 2FA"}
            </Button>
            <Button size="small" onClick={reset} sx={{ color: "text.secondary" }}>
              Cancelar
            </Button>
          </Box>
        )}

        {/* Password change section — only in idle stage */}
        {stage === "idle" && (
          <>
            <Divider sx={{ my: 2.5 }} />
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1.5 }}>
              Trocar senha
            </Typography>
            {senhaErr && <Alert severity="error" sx={{ mb: 2 }}>{senhaErr}</Alert>}
            <Box component="form" onSubmit={handleAlterarSenha} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="Senha atual"
                type={showAtual ? "text" : "password"}
                value={senhaForm.atual}
                onChange={(e) => setSenhaForm((p) => ({ ...p, atual: e.target.value }))}
                required fullWidth size="small"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowAtual((v) => !v)} edge="end">
                          {showAtual ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                label="Nova senha"
                type={showNova ? "text" : "password"}
                value={senhaForm.nova}
                onChange={(e) => setSenhaForm((p) => ({ ...p, nova: e.target.value }))}
                required fullWidth size="small"
                helperText="Mín. 8 caracteres com maiúscula, minúscula, número e especial"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowNova((v) => !v)} edge="end">
                          {showNova ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                label="Confirmar nova senha"
                type={showConfirmar ? "text" : "password"}
                value={senhaForm.confirmar}
                onChange={(e) => setSenhaForm((p) => ({ ...p, confirmar: e.target.value }))}
                required fullWidth size="small"
                error={senhaForm.confirmar.length > 0 && senhaForm.nova !== senhaForm.confirmar}
                helperText={senhaForm.confirmar.length > 0 && senhaForm.nova !== senhaForm.confirmar ? "As senhas não coincidem" : undefined}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowConfirmar((v) => !v)} edge="end">
                          {showConfirmar ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Button
                type="submit"
                variant="outlined"
                fullWidth
                disabled={senhaLoading || !senhaForm.atual || !senhaForm.nova || senhaForm.nova !== senhaForm.confirmar}
              >
                {senhaLoading ? <CircularProgress size={16} color="inherit" /> : "Alterar senha"}
              </Button>
            </Box>
          </>
        )}
      </DialogContent>

      {stage === "idle" && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose}>Fechar</Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
