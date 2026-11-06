import { useLayoutEffect, useRef, useState } from "react";
import { Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AccessTimeFilledRoundedIcon from "@mui/icons-material/AccessTimeFilledRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { useNavigate } from "react-router-dom";
import { useAssinatura } from "../../context/AssinaturaContext";
import { useAuth } from "../../context/AuthContext";
import { brand } from "../../app/theme";
import { paths } from "../../routes/paths";
import { CHAVE_FAIXA_FECHADA, VAR_ALTURA_FAIXA, faixaDaAssinatura, linkFalarComEquipe } from "../../modules/assinatura/assinatura";

// Fundo cheio com texto branco (contraste ≥ 4,5:1 nos três).
const TONS = {
  info: { bg: brand.primary, icone: <AccessTimeFilledRoundedIcon /> },
  alerta: { bg: "#B45309", icone: <WarningRoundedIcon /> },
  erro: { bg: brand.error, icone: <LockRoundedIcon /> },
} as const;

function lerFechada() {
  try {
    return localStorage.getItem(CHAVE_FAIXA_FECHADA) === "1";
  } catch {
    return false;
  }
}

/**
 * Faixa no topo da tela, acima da barra do sistema: dias que faltam do teste grátis, ou o aviso de conta só leitura.
 * O X esconde até o próximo login.
 */
export default function FaixaAssinatura() {
  const { assinatura } = useAssinatura();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fechada, setFechada] = useState(lerFechada);
  const ref = useRef<HTMLDivElement>(null);

  const faixa = fechada ? null : faixaDaAssinatura(assinatura);

  // Publica a altura real (a faixa quebra linha no celular) para o resto do layout descer junto.
  useLayoutEffect(() => {
    const raiz = document.documentElement;
    const el = ref.current;
    if (!el) {
      raiz.style.setProperty(VAR_ALTURA_FAIXA, "0px");
      return;
    }
    const publicar = () => raiz.style.setProperty(VAR_ALTURA_FAIXA, `${el.offsetHeight}px`);
    publicar();
    const observer = new ResizeObserver(publicar);
    observer.observe(el);
    return () => {
      observer.disconnect();
      raiz.style.setProperty(VAR_ALTURA_FAIXA, "0px");
    };
  }, [faixa?.tom, faixa?.titulo]);

  if (!faixa) return null;

  const tom = TONS[faixa.tom];
  const externo = faixa.acao === "falar";
  const oficina = { nome: user?.oficina_nome, id: user?.oficinaId };

  const fechar = () => {
    try {
      localStorage.setItem(CHAVE_FAIXA_FECHADA, "1");
    } catch {
      // Sem storage: fecha só até recarregar a página.
    }
    setFechada(true);
  };

  return (
    <Box
      ref={ref}
      role="status"
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: (t) => t.zIndex.drawer + 2,
        display: "flex",
        alignItems: "center",
        gap: { xs: 1, sm: 1.5 },
        minHeight: 40,
        pl: { xs: 1.5, sm: 2.5 },
        pr: { xs: 0.5, sm: 1.5 },
        py: 0.5,
        bgcolor: tom.bg,
        color: "#fff",
      }}
    >
      <Box sx={{ display: { xs: "none", sm: "flex" }, "& svg": { fontSize: 18 } }}>{tom.icone}</Box>
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.35 }}>
        <Box component="strong" sx={{ fontWeight: 700 }}>{faixa.titulo}</Box> {faixa.texto}
      </Typography>
      <Button
        size="small"
        variant="contained"
        disableElevation
        endIcon={externo ? <OpenInNewRoundedIcon sx={{ fontSize: "14px !important" }} /> : undefined}
        {...(externo
          ? {
              href: linkFalarComEquipe(oficina, "Minha assinatura do Auttra está suspensa e quero reativar."),
              target: "_blank",
              rel: "noopener",
            }
          : { onClick: () => navigate(paths.assinatura) })}
        sx={{
          flexShrink: 0,
          bgcolor: "#fff",
          color: tom.bg,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          py: 0.25,
          px: 1.5,
          "&:hover": { bgcolor: "rgba(255,255,255,0.9)" },
        }}
      >
        {externo ? "Falar com a gente" : "Ver planos"}
      </Button>
      <Tooltip title="Fechar">
        <IconButton aria-label="Fechar aviso" size="small" onClick={fechar} sx={{ color: "#fff", flexShrink: 0 }}>
          <CloseRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
