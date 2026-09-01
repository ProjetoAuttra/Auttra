import { type FormEvent, useMemo, useState } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../../api/api";
import { paths } from "../../../routes/paths";
import logo from "../../../assets/logo.png";

const BLUE_MAIN = "#2563EB";
const BLUE_DARK = "#1E3A8A";
const TEAL = "#0F766E";
const INK = "#111827";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = useMemo(() => params.get("token") ?? "", [params]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!token) {
      setError("Link de recuperacao invalido.");
      return;
    }
    if (password.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("A confirmacao nao corresponde a nova senha.");
      return;
    }

    try {
      setLoading(true);
      await api.post("/auth/reset-password", { token, nova_senha: password });
      setMessage("Senha redefinida com sucesso. Voce ja pode entrar com a nova senha.");
      setTimeout(() => nav(paths.login, { replace: true }), 1800);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Nao foi possivel redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#F6F8FB",
        backgroundImage: `
          linear-gradient(135deg, ${alpha(BLUE_DARK, 0.08)} 0%, transparent 34%),
          linear-gradient(315deg, ${alpha(TEAL, 0.10)} 0%, transparent 38%)
        `,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 440, mx: 3 }}>
        <Stack alignItems="center" mb={5}>
          <Box component="img" src={logo} alt="Auttra" sx={{ height: 62, width: "auto", objectFit: "contain" }} />
        </Stack>

        <Box sx={{ bgcolor: "#fff", border: "1px solid #D9E2EC", borderRadius: 2, px: { xs: 3.5, sm: 5 }, py: 4.5, boxShadow: "0 24px 70px rgba(15, 23, 42, 0.12)" }}>
          <Stack spacing={0.75} mb={3}>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: INK, lineHeight: 1.2 }}>
              Redefinir senha
            </Typography>
            <Typography sx={{ fontSize: 14, color: alpha(INK, 0.6) }}>
              Informe uma nova senha para acessar o Auttra.
            </Typography>
          </Stack>

          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}
              {message && <Alert severity="success">{message}</Alert>}

              <TextField
                label="Nova senha"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                fullWidth
                autoFocus
              />
              <TextField
                label="Confirmar nova senha"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                fullWidth
              />

              <Button type="submit" variant="contained" disabled={loading} disableElevation sx={{ height: 48, borderRadius: 2, fontWeight: 700, textTransform: "none", bgcolor: BLUE_MAIN }}>
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>

              <Button component={Link} to={paths.login} variant="text" sx={{ textTransform: "none" }}>
                Voltar para o login
              </Button>
            </Stack>
          </form>
        </Box>
      </Box>
    </Box>
  );
}
