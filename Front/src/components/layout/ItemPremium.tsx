import { Box, ButtonBase, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import { useAssinatura } from "../../context/AssinaturaContext";
import { brand } from "../../app/theme";
import type { Assinatura } from "../../modules/assinatura/assinatura";

function legenda(a: Assinatura) {
  if (a.situacao === "teste") {
    const dias = a.diasRestantes ?? 0;
    return dias === 0 ? "Último dia de teste" : dias === 1 ? "Falta 1 dia de teste" : `Faltam ${dias} dias de teste`;
  }
  if (a.situacao === "teste_vencido") return "Teste encerrado";
  return "Assinatura suspensa";
}

/** Atalho para os planos, fixo no pé do menu enquanto a oficina não assina (teste, vencido ou suspensa). */
export default function ItemPremium({ collapsed, onClick }: { collapsed?: boolean; onClick?: () => void }) {
  const { assinatura, planosAbertos, abrirPlanos } = useAssinatura();
  if (!assinatura || assinatura.situacao === "ativa") return null;

  const selecionado = planosAbertos;
  const abrir = () => {
    abrirPlanos();
    onClick?.();
  };

  const fundo = `linear-gradient(135deg, ${brand.primary} 0%, ${brand.primaryDark} 100%)`;

  if (collapsed) {
    return (
      <Box sx={{ px: 1, pb: 0.5, display: "flex", justifyContent: "center" }}>
        <Tooltip title={`Premium · ${legenda(assinatura)}`} placement="right" arrow>
          <ButtonBase
            aria-label="Premium"
            onClick={abrir}
            sx={{
              width: 44,
              height: 44,
              borderRadius: 1.5,
              background: fundo,
              color: "#fff",
              boxShadow: selecionado ? `0 0 0 3px ${brand.primaryTint}` : "none",
              "& svg": { fontSize: 22 },
            }}
          >
            <WorkspacePremiumRoundedIcon />
          </ButtonBase>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 1.5, pb: 0.5 }}>
      <ButtonBase
        onClick={abrir}
        sx={{
          width: "100%",
          justifyContent: "flex-start",
          gap: 1.5,
          px: 2,
          py: 1.25,
          borderRadius: 1.5,
          background: fundo,
          color: "#fff",
          textAlign: "left",
          boxShadow: selecionado ? `0 0 0 3px ${brand.primaryTint}` : `0 6px 16px ${alpha(brand.primary, 0.25)}`,
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
          "&:hover": { transform: "translateY(-1px)", boxShadow: `0 8px 20px ${alpha(brand.primary, 0.32)}` },
        }}
      >
        <WorkspacePremiumRoundedIcon sx={{ fontSize: 22, flexShrink: 0 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>Premium</Typography>
          <Typography sx={{ fontSize: 12, opacity: 0.85, lineHeight: 1.3 }}>{legenda(assinatura)}</Typography>
        </Box>
      </ButtonBase>
    </Box>
  );
}
