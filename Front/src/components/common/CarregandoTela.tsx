import { Box, CircularProgress } from "@mui/material";

/** Enquanto o código de uma tela é baixado (rotas carregadas sob demanda). */
export default function CarregandoTela() {
  return (
    <Box role="status" aria-label="Carregando" sx={{ display: "flex", justifyContent: "center", py: 8 }}>
      <CircularProgress size={28} />
    </Box>
  );
}
