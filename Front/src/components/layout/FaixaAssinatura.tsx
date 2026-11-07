import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, ButtonBase, IconButton, Tooltip, Typography } from "@mui/material";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AccessTimeFilledRoundedIcon from "@mui/icons-material/AccessTimeFilledRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { useNavigate } from "react-router-dom";
import { useAssinatura } from "../../context/AssinaturaContext";
import { brand } from "../../app/theme";
import { paths } from "../../routes/paths";
import { CHAVE_FAIXA_FECHADA, VAR_ALTURA_FAIXA, faixaDaAssinatura, hojeSP } from "../../modules/assinatura/assinatura";

// Fundo cheio com texto branco (contraste ≥ 4,5:1 nos três).
const TONS = {
  info: { bg: brand.primary, icone: <AccessTimeFilledRoundedIcon /> },
  alerta: { bg: "#B45309", icone: <WarningRoundedIcon /> },
  erro: { bg: brand.error, icone: <LockRoundedIcon /> },
} as const;

function lerFechada() {
  try {
    return localStorage.getItem(CHAVE_FAIXA_FECHADA) === hojeSP();
  } catch {
    return false;
  }
}

/**
 * Faixa no topo da tela, acima da barra do sistema: dias que faltam do teste grátis, ou o aviso de conta só leitura.
 * O X esconde só naquele dia: no dia seguinte (ou num novo login) ela volta.
 */
export default function FaixaAssinatura() {
  const { assinatura } = useAssinatura();
  const navigate = useNavigate();
  const [fechada, setFechada] = useState(lerFechada);
  const ref = useRef<HTMLDivElement>(null);

  // Aba aberta de um dia para o outro: ao voltar para ela, a faixa fechada ontem reaparece.
  useEffect(() => {
    const conferir = () => setFechada(lerFechada());
    window.addEventListener("focus", conferir);
    document.addEventListener("visibilitychange", conferir);
    return () => {
      window.removeEventListener("focus", conferir);
      document.removeEventListener("visibilitychange", conferir);
    };
  }, []);

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

  const fechar = () => {
    try {
      localStorage.setItem(CHAVE_FAIXA_FECHADA, hojeSP());
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
        minHeight: 40,
        // Espaço dos dois lados para o X (absoluto à direita) não tirar o texto do centro.
        px: { xs: 5, sm: 6 },
        py: 0.75,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: tom.bg,
        color: "#fff",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          columnGap: 1.5,
          rowGap: 0.5,
          textAlign: "center",
        }}
      >
        <Typography component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1, fontSize: 13, lineHeight: 1.35 }}>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline-flex" }, "& svg": { fontSize: 18 } }}>{tom.icone}</Box>
          <span>
            <Box component="strong" sx={{ fontWeight: 700 }}>{faixa.titulo}</Box> {faixa.texto}
          </span>
        </Typography>
        {/* Link em pílula translúcida, não um botão sólido: fica leve sobre a cor da faixa. */}
        <ButtonBase
          onClick={() => navigate(paths.assinatura)}
          sx={{
            gap: 0.5,
            px: 1.5,
            py: 0.375,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.55)",
            bgcolor: "rgba(255,255,255,0.14)",
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 700,
            whiteSpace: "nowrap",
            transition: "background-color 0.15s ease, border-color 0.15s ease",
            "&:hover": { bgcolor: "rgba(255,255,255,0.26)", borderColor: "#fff" },
            "&:hover .seta": { transform: "translateX(2px)" },
            "&.Mui-focusVisible": { outline: "2px solid #fff", outlineOffset: 2 },
          }}
        >
          <WorkspacePremiumRoundedIcon sx={{ fontSize: 15 }} />
          Adquirir Premium
          <ArrowForwardRoundedIcon className="seta" sx={{ fontSize: 15, transition: "transform 0.15s ease" }} />
        </ButtonBase>
      </Box>
      <Tooltip title="Fechar">
        <IconButton
          aria-label="Fechar aviso"
          size="small"
          onClick={fechar}
          sx={{ position: "absolute", right: { xs: 4, sm: 12 }, top: "50%", transform: "translateY(-50%)", color: "#fff" }}
        >
          <CloseRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
