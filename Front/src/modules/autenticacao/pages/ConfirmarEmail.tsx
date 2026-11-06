import { useEffect, useState } from "react";
import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../../api/api";
import { useAuth } from "../../../context/AuthContext";
import { paths } from "../../../routes/paths";
import TelaAutenticacao from "../components/TelaAutenticacao";

type Estado = { tipo: "carregando" } | { tipo: "ok" } | { tipo: "erro"; mensagem: string };

/** Destino do link do e-mail de boas-vindas. Confirmar de novo não é erro: o back devolve sucesso. */
export default function ConfirmarEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { isAuthenticated } = useAuth();
  const [estado, setEstado] = useState<Estado>(() =>
    token ? { tipo: "carregando" } : { tipo: "erro", mensagem: "Link de confirmação inválido." }
  );

  useEffect(() => {
    if (!token) return;
    let ativo = true;
    api
      .post("/auth/confirmar-email", { token })
      .then(() => ativo && setEstado({ tipo: "ok" }))
      .catch((err) =>
        ativo && setEstado({
          tipo: "erro",
          mensagem: err?.response?.data?.message ?? "Não foi possível confirmar o e-mail agora. Tente de novo.",
        })
      );
    return () => { ativo = false; };
  }, [token]);

  const destino = isAuthenticated ? paths.root : paths.login;
  const textoBotao = isAuthenticated ? "Voltar ao Auttra" : "Entrar no Auttra";

  return (
    <TelaAutenticacao titulo="Confirmação de e-mail">
      <Stack spacing={3}>
        {estado.tipo === "carregando" && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={18} />
            <Typography sx={{ fontSize: 14 }}>Confirmando seu e-mail...</Typography>
          </Stack>
        )}
        {estado.tipo === "ok" && <Alert severity="success">E-mail confirmado. Obrigado!</Alert>}
        {estado.tipo === "erro" && <Alert severity="error">{estado.mensagem}</Alert>}
        {estado.tipo !== "carregando" && (
          <Button component={Link} to={destino} replace variant="contained" disableElevation sx={{ height: 46, textTransform: "none", fontWeight: 700 }}>
            {textoBotao}
          </Button>
        )}
      </Stack>
    </TelaAutenticacao>
  );
}
