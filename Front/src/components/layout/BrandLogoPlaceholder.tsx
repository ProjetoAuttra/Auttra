import { Box, Typography } from "@mui/material";
import { brand } from "../../app/theme";

/**
 * Marca provisória (monograma + nome) até existir o asset definitivo da logo.
 * Trocar o conteúdo deste componente é o único lugar que precisa mudar.
 */
export default function BrandLogoPlaceholder({
  compact = false,
  onDark = false,
}: {
  compact?: boolean;
  onDark?: boolean;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, userSelect: "none", flexShrink: 0 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          display: "grid",
          placeItems: "center",
          bgcolor: brand.primary,
          color: "#FFFFFF",
          fontSize: 17,
          fontWeight: 700,
        }}
      >
        A
      </Box>
      {!compact && (
        <Typography
          sx={{
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: onDark ? "#FFFFFF" : brand.ink,
          }}
        >
          Auttra
        </Typography>
      )}
    </Box>
  );
}
