import { useState } from "react";
import { Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useNavigate } from "react-router-dom";
import { useAssinatura } from "../../context/AssinaturaContext";
import { useAuth } from "../../context/AuthContext";
import { brand } from "../../app/theme";
import { paths } from "../../routes/paths";
import { faixaDaAssinatura, hojeSP, linkFalarComEquipe } from "../../modules/assinatura/assinatura";

const chaveFechada = (oficinaId?: number) => `auttra:faixa-teste-fechada:${oficinaId ?? 0}`;

function fechadaHoje(oficinaId?: number) {
  try {
    return localStorage.getItem(chaveFechada(oficinaId)) === hojeSP();
  } catch {
    return false;
  }
}

const TONS = {
  info: { bg: brand.primarySoft, borda: brand.primaryBorder, texto: brand.primaryDark, icone: <AccessTimeRoundedIcon /> },
  alerta: { bg: "#FFFBEB", borda: "#FDE68A", texto: "#92400E", icone: <LockOutlinedIcon /> },
} as const;

/**
 * Faixa logo abaixo da barra do topo: quantos dias faltam do teste grátis ou o aviso de conta só leitura.
 * Durante o teste dá para fechar, e ela volta no dia seguinte (com a contagem nova).
 */
export default function FaixaAssinatura() {
  const { assinatura } = useAssinatura();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fechada, setFechada] = useState(() => fechadaHoje(user?.oficinaId));

  const faixa = faixaDaAssinatura(assinatura);
  if (!faixa || (faixa.podeFechar && fechada)) return null;

  const tom = TONS[faixa.tom];
  const oficina = { nome: user?.oficina_nome, id: user?.oficinaId };

  const fechar = () => {
    try {
      localStorage.setItem(chaveFechada(user?.oficinaId), hojeSP());
    } catch {
      // Sem storage: fecha só até recarregar a página.
    }
    setFechada(true);
  };

  return (
    <Box
      role="status"
      sx={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: { xs: 1, sm: 1.5 },
        px: { xs: 1.5, sm: 2.5, md: 4 },
        py: 0.75,
        bgcolor: tom.bg,
        borderTop: `1px solid ${tom.borda}`,
        borderBottom: `1px solid ${tom.borda}`,
        color: tom.texto,
      }}
    >
      <Box sx={{ display: { xs: "none", sm: "flex" }, "& svg": { fontSize: 18 } }}>{tom.icone}</Box>
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, lineHeight: 1.35 }}>
        {faixa.texto}
      </Typography>
      {faixa.acao === "planos" ? (
        <Button
          size="small"
          variant="contained"
          disableElevation
          onClick={() => navigate(paths.assinatura)}
          sx={{ flexShrink: 0, textTransform: "none", fontWeight: 700, py: 0.25, whiteSpace: "nowrap" }}
        >
          Ver planos
        </Button>
      ) : (
        <Button
          size="small"
          variant="contained"
          disableElevation
          href={linkFalarComEquipe(oficina, "Minha assinatura do Auttra está suspensa e quero reativar.")}
          target="_blank"
          rel="noopener"
          sx={{ flexShrink: 0, textTransform: "none", fontWeight: 700, py: 0.25, whiteSpace: "nowrap" }}
        >
          Falar com a gente
        </Button>
      )}
      {faixa.podeFechar && (
        <Tooltip title="Fechar até amanhã">
          <IconButton aria-label="Fechar aviso" size="small" onClick={fechar} sx={{ color: "inherit", flexShrink: 0 }}>
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
