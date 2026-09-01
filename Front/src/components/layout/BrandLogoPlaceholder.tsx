import { Box } from "@mui/material";

/**
 * Placeholder temporário para a logo da marca. Quando o asset definitivo
 * existir, trocar o conteúdo deste componente (texto -> imagem) é o único
 * lugar que precisa mudar.
 */
export default function BrandLogoPlaceholder() {
  return (
    <Box
      component="span"
      sx={{
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: 1.5,
        color: "text.secondary",
        userSelect: "none",
        mr: 2,
        flexShrink: 0,
      }}
    >
      LOGO
    </Box>
  );
}
