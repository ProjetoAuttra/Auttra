import { Box } from "@mui/material";

/**
 * Logo da Auttra (arquivos em public/brand/svg).
 * Fundo claro: versão azul; fundo azul/escuro (`onDark`): versão branca.
 * `compact` (menu recolhido, espaço quadrado): só o símbolo.
 * Só a altura é definida, para manter a proporção; abaixo de 24 px use as versões "chapada".
 */
export default function BrandLogoPlaceholder({
  compact = false,
  onDark = false,
}: {
  compact?: boolean;
  onDark?: boolean;
}) {
  const src = compact
    ? `/brand/svg/auttra-simbolo-${onDark ? "branco" : "azul"}.svg`
    : `/brand/svg/auttra-logo-${onDark ? "branca" : "azul"}.svg`;

  return (
    <Box
      component="img"
      src={src}
      alt="Auttra"
      sx={{ height: 30, width: "auto", display: "block", flexShrink: 0, userSelect: "none" }}
    />
  );
}
