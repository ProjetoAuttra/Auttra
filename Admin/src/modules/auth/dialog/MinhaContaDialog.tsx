import React, { useState } from "react";
import {
  Dialog, Box, Typography, IconButton, DialogContent, DialogActions,
  Button, CircularProgress, TextField, Divider, Chip, Alert,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { QRCodeSVG } from "qrcode.react";
import api from "../../../api/api";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";

type Props = { open: boolean; onClose: () => void };
type Stage = "idle" | "setup-qr" | "setup-confirm" | "disable";

export function MinhaContaDialog({ open, onClose }: Props) {
  const { user, refreshMe } = useAuth();
  const { success, error } = useToast();

  const [stage, setStage] = useState<Stage>("idle");
  const [otpauth, setOtpauth] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  function reset() {
    setStage("idle");
    setOtpauth("");
    setCode("");
    setErr("");
  }

  function handleClose() {
    reset();
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
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleSetup}
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={16} color="inherit" /> : "Ativar 2FA"}
                </Button>
              </>
            ) : (
              <>
                <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
                  O 2FA está ativo na sua conta. Para desativar, confirme com o código atual do Google Authenticator.
                </Typography>
                <Button
                  variant="outlined"
                  fullWidth
                  color="error"
                  onClick={() => setStage("disable")}
                >
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
              autoFocus
              fullWidth
              size="small"
              inputProps={{ inputMode: "numeric", maxLength: 6 }}
            />
            <Button
              variant="contained"
              fullWidth
              disabled={loading || code.length !== 6}
              onClick={handleConfirm}
            >
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
              autoFocus
              fullWidth
              size="small"
              inputProps={{ inputMode: "numeric", maxLength: 6 }}
            />
            <Button
              variant="outlined"
              color="error"
              fullWidth
              disabled={loading || code.length !== 6}
              onClick={handleDisable}
            >
              {loading ? <CircularProgress size={16} color="inherit" /> : "Desativar 2FA"}
            </Button>
            <Button size="small" onClick={reset} sx={{ color: "text.secondary" }}>
              Cancelar
            </Button>
          </Box>
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
