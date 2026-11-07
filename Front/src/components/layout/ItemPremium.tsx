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

  const abrir = () => {
    abrirPlanos();
    onClick?.();
  };

  // Recolhido: só o ícone, com a legenda no tooltip; aberto: ícone, "Premium" e os dias de teste.
  return (
    <Box sx={{ px: collapsed ? 1 : 1.5, pb: 0.5, display: "flex", justifyContent: "center" }}>
      <Tooltip title={collapsed ? `Premium · ${legenda(assinatura)}` : ""} placement="right" arrow>
        <ButtonBase
          aria-label={collapsed ? `Premium: ${legenda(assinatura)}` : undefined}
          onClick={abrir}
          sx={{
            width: collapsed ? 44 : "100%",
            height: collapsed ? 44 : "auto",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 1.5,
            px: collapsed ? 0 : 2,
            py: collapsed ? 0 : 1.25,
            borderRadius: 1.5,
            background: `linear-gradient(135deg, ${brand.primary} 0%, ${brand.primaryDark} 100%)`,
            color: "#fff",
            textAlign: "left",
            boxShadow: planosAbertos ? `0 0 0 3px ${brand.primaryTint}` : `0 6px 16px ${alpha(brand.primary, 0.25)}`,
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
            "&:hover": { transform: "translateY(-1px)", boxShadow: `0 8px 20px ${alpha(brand.primary, 0.32)}` },
          }}
        >
          <WorkspacePremiumRoundedIcon sx={{ fontSize: 22, flexShrink: 0 }} />
          {!collapsed && (
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>Premium</Typography>
              <Typography sx={{ fontSize: 12, opacity: 0.85, lineHeight: 1.3 }}>{legenda(assinatura)}</Typography>
            </Box>
          )}
        </ButtonBase>
      </Tooltip>
    </Box>
  );
}
