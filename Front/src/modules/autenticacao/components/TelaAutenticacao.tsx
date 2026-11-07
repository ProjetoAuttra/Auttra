import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { brand } from "../../../app/theme";

const logo = "/brand/svg/auttra-logo-azul.svg";

/** Campos das telas de entrada (login, cadastro): mesmo visual em todas. */
export const campoAutenticacaoSx = {
  "& .MuiInputLabel-root": { color: alpha(brand.ink, 0.56), fontSize: 14 },
  "& .MuiInputLabel-root.Mui-focused": { color: brand.primary },
  "& .MuiOutlinedInput-root": {
    color: brand.ink,
    fontSize: 14,
    borderRadius: 1.5,
    bgcolor: "#fff",
    "& fieldset": { borderColor: brand.line },
    "&:hover fieldset": { borderColor: alpha(brand.primary, 0.5) },
    "&.Mui-focused fieldset": { borderColor: brand.primary },
  },
} as const;

type Props = {
  titulo: string;
  subtitulo?: ReactNode;
  children: ReactNode;
  /** Linha abaixo do cartão (ex.: "Já tem conta? Entrar"). */
  rodape?: ReactNode;
  larguraMaxima?: number;
};

/** Fundo, logo e cartão central das telas fora do sistema (cadastro, confirmação de e-mail). */
export default function TelaAutenticacao({ titulo, subtitulo, children, rodape, larguraMaxima = 440 }: Props) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        py: 4,
        bgcolor: brand.page,
        backgroundImage: `
          linear-gradient(135deg, ${alpha(brand.primaryDark, 0.08)} 0%, transparent 34%),
          linear-gradient(315deg, ${alpha(brand.teal, 0.1)} 0%, transparent 38%)
        `,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: larguraMaxima, mx: 2 }}>
        <Stack alignItems="center" mb={4}>
          <Box component="img" src={logo} alt="Auttra" sx={{ height: 56, width: "auto", objectFit: "contain" }} />
        </Stack>

        <Box
          sx={{
            bgcolor: "#FFFFFF",
            border: `1px solid ${brand.line}`,
            borderRadius: 2,
            px: { xs: 3, sm: 5 },
            pt: 4.5,
            pb: 5,
            boxShadow: "0 24px 70px rgba(15, 23, 42, 0.12)",
          }}
        >
          <Stack spacing={0.75} mb={3.5}>
            <Typography component="h1" sx={{ fontSize: 22, fontWeight: 700, color: brand.ink, lineHeight: 1.2 }}>
              {titulo}
            </Typography>
            {subtitulo && <Typography sx={{ fontSize: 14, color: alpha(brand.ink, 0.6) }}>{subtitulo}</Typography>}
          </Stack>
          {children}
        </Box>

        {rodape && (
          <Typography component="div" sx={{ textAlign: "center", mt: 3, fontSize: 14, color: alpha(brand.ink, 0.62) }}>
            {rodape}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
