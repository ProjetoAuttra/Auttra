import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Alert, Box, Button, Checkbox, CircularProgress, Collapse, FormControlLabel, IconButton, InputAdornment, Link as MuiLink,
  Stack, TextField, Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { siteUrl, turnstileSiteKey } from "../../../api/api";
import { brand } from "../../../app/theme";
import TurnstileWidget, { type TurnstileWidgetHandle } from "../../../components/common/TurnstileWidget";
import { useAuth } from "../../../context/AuthContext";
import { paths } from "../../../routes/paths";
import { maskTelefone } from "../../../utils/masks";
import TelaAutenticacao, { campoAutenticacaoSx } from "../components/TelaAutenticacao";
import { CHAVE_UTM, SENHA_MIN, lerCampanha, validarCadastro, type Campo, type Erros } from "../cadastro";

export default function Cadastro() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { isAuthenticated, signUp } = useAuth();

  const [nome, setNome] = useState("");
  const [oficina, setOficina] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState(() => params.get("email") ?? "");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [site, setSite] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const [campanha] = useState(() => lerCampanha(params));

  const [erros, setErros] = useState<Erros>({});
  const [erro, setErro] = useState<string | null>(null);
  const [emailJaCadastrado, setEmailJaCadastrado] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Teste grátis por 7 dias | Auttra";
  }, []);

  // Quem já está logado não tem o que cadastrar aqui.
  if (isAuthenticated && !loading) return <Navigate to={paths.root} replace />;

  const limpar = (campo: Campo) => {
    setErros((e) => ({ ...e, [campo]: undefined }));
    setErro(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEmailJaCadastrado(false);

    const encontrados = validarCadastro({ nome, oficina, whatsapp, email, senha, aceite });
    setErros(encontrados);
    if (Object.keys(encontrados).length) return;
    if (!turnstileToken) {
      setErro("Complete a verificação de segurança.");
      return;
    }

    try {
      setLoading(true);
      await signUp({
        nome: nome.trim(),
        oficina: oficina.trim(),
        whatsapp: whatsapp.replace(/\D/g, ""),
        email: email.trim(),
        senha,
        aceite_termos: true,
        turnstileToken,
        campanha,
        site,
      });
      try { sessionStorage.removeItem(CHAVE_UTM); } catch { /* sem storage: nada a limpar */ }
      nav(paths.root, { replace: true, state: { boasVindas: true } });
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.code === "EMAIL_JA_CADASTRADO") setEmailJaCadastrado(true);
      setErro(data?.message ?? "Não foi possível criar a conta agora. Tente de novo.");
      // O token do Turnstile vale uma vez só: cada nova tentativa pede outro.
      setTurnstileToken("");
      turnstileRef.current?.reset();
      setLoading(false);
    }
  };

  return (
    <TelaAutenticacao
      titulo="Teste o Auttra grátis por 7 dias"
      subtitulo="Crie sua conta em 1 minuto. Sem cartão de crédito."
      rodape={
        <>
          Já tem conta?{" "}
          <MuiLink component={Link} to={paths.login} sx={{ fontWeight: 600 }}>
            Entrar
          </MuiLink>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <Stack spacing={2.25}>
          <TextField
            label="Seu nome"
            fullWidth
            value={nome}
            onChange={(e) => { setNome(e.target.value); limpar("nome"); }}
            autoComplete="name"
            autoFocus
            error={!!erros.nome}
            helperText={erros.nome}
            slotProps={{ htmlInput: { maxLength: 120 } }}
            sx={campoAutenticacaoSx}
          />
          <TextField
            label="Nome da oficina"
            fullWidth
            value={oficina}
            onChange={(e) => { setOficina(e.target.value); limpar("oficina"); }}
            autoComplete="organization"
            error={!!erros.oficina}
            helperText={erros.oficina}
            slotProps={{ htmlInput: { maxLength: 120 } }}
            sx={campoAutenticacaoSx}
          />
          <TextField
            label="WhatsApp"
            fullWidth
            value={whatsapp}
            onChange={(e) => { setWhatsapp(maskTelefone(e.target.value)); limpar("whatsapp"); }}
            autoComplete="tel-national"
            placeholder="(11) 9 9999-9999"
            error={!!erros.whatsapp}
            helperText={erros.whatsapp}
            slotProps={{ htmlInput: { inputMode: "tel" } }}
            sx={campoAutenticacaoSx}
          />
          <TextField
            label="E-mail"
            type="email"
            fullWidth
            value={email}
            onChange={(e) => { setEmail(e.target.value); limpar("email"); setEmailJaCadastrado(false); }}
            autoComplete="email"
            error={!!erros.email || emailJaCadastrado}
            helperText={erros.email}
            slotProps={{ htmlInput: { maxLength: 254 } }}
            sx={campoAutenticacaoSx}
          />
          <TextField
            label="Crie uma senha"
            type={mostrarSenha ? "text" : "password"}
            fullWidth
            value={senha}
            onChange={(e) => { setSenha(e.target.value); limpar("senha"); }}
            autoComplete="new-password"
            error={!!erros.senha}
            helperText={erros.senha ?? `Mínimo de ${SENHA_MIN} caracteres.`}
            slotProps={{
              htmlInput: { maxLength: 72 },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setMostrarSenha((s) => !s)}
                      edge="end"
                      size="small"
                      sx={{ color: alpha(brand.ink, 0.48) }}
                    >
                      {mostrarSenha ? <VisibilityOff sx={{ fontSize: 17 }} /> : <Visibility sx={{ fontSize: 17 }} />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
            sx={campoAutenticacaoSx}
          />

          {/* Campo-isca: invisível para pessoas; robô que preenche tudo é recusado no servidor. */}
          <Box aria-hidden="true" sx={{ position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" }}>
            <label>
              Site
              <input name="site" tabIndex={-1} autoComplete="off" value={site} onChange={(e) => setSite(e.target.value)} />
            </label>
          </Box>

          <Box>
            <FormControlLabel
              sx={{ alignItems: "flex-start", mr: 0 }}
              control={
                <Checkbox
                  checked={aceite}
                  onChange={(e) => { setAceite(e.target.checked); limpar("aceite"); }}
                  size="small"
                  sx={{ p: 0.5, mt: -0.25 }}
                />
              }
              label={
                <Typography sx={{ fontSize: 13, color: alpha(brand.ink, 0.72) }}>
                  Li e aceito os{" "}
                  <MuiLink href={`${siteUrl}/termos/`} target="_blank" rel="noopener">Termos de uso</MuiLink>
                  {" "}e a{" "}
                  <MuiLink href={`${siteUrl}/privacidade/`} target="_blank" rel="noopener">Política de Privacidade</MuiLink>.
                </Typography>
              }
            />
            {erros.aceite && (
              <Typography role="alert" sx={{ fontSize: 12, color: "error.main", mt: 0.5, ml: 4 }}>
                {erros.aceite}
              </Typography>
            )}
          </Box>

          <TurnstileWidget
            ref={turnstileRef}
            siteKey={turnstileSiteKey}
            // Não apaga o erro: depois de uma recusa o Turnstile se resolve sozinho e a mensagem sumiria antes de ser lida.
            onVerify={setTurnstileToken}
            onExpire={() => setTurnstileToken("")}
            onError={() => setTurnstileToken("")}
          />

          <Collapse in={!!erro}>
            <Alert
              severity="error"
              sx={{ borderRadius: 2, fontSize: 13 }}
              action={
                emailJaCadastrado ? (
                  <Stack direction="row" spacing={0.5}>
                    <Button color="inherit" size="small" component={Link} to={paths.login}>
                      Entrar
                    </Button>
                    <Button color="inherit" size="small" component={Link} to={paths.login} state={{ esqueciSenha: true }}>
                      Recuperar senha
                    </Button>
                  </Stack>
                ) : undefined
              }
            >
              {erro}
            </Alert>
          </Collapse>

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disableElevation
            disabled={loading || !turnstileToken}
            startIcon={loading ? <CircularProgress size={16} thickness={5} sx={{ color: "#fff" }} /> : undefined}
            sx={{ height: 50, fontWeight: 700, fontSize: 14, textTransform: "none" }}
          >
            {loading ? "Criando sua conta..." : "Criar conta e começar o teste"}
          </Button>
        </Stack>
      </form>
    </TelaAutenticacao>
  );
}
