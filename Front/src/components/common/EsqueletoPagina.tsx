import { Box, Skeleton, Stack } from "@mui/material";

/** Cartões de números e um bloco de tabela: o formato da maioria das telas enquanto os dados chegam. */
export function EsqueletoConteudo({ cartoes = 4, linhas = 6 }: { cartoes?: number; linhas?: number }) {
  return (
    <Box role="status" aria-label="Carregando">
      {cartoes > 0 && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", md: `repeat(${cartoes}, 1fr)` },
            gap: 2,
            mb: 3,
          }}
        >
          {Array.from({ length: cartoes }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={84} />
          ))}
        </Box>
      )}
      <Stack spacing={1.25}>
        <Skeleton variant="rounded" height={40} />
        {Array.from({ length: linhas }).map((_, i) => (
          <Skeleton key={i} variant="text" height={36} width={i % 2 ? "92%" : "100%"} />
        ))}
      </Stack>
    </Box>
  );
}

/** Tela inteira em esqueleto (título + conteúdo), no lugar do spinner enquanto a tela abre. */
export default function EsqueletoPagina({ cartoes, linhas }: { cartoes?: number; linhas?: number }) {
  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>
      <Box sx={{ mb: 3 }}>
        <Skeleton variant="text" width={220} height={36} />
        <Skeleton variant="text" width={360} height={20} sx={{ maxWidth: "80%" }} />
      </Box>
      <EsqueletoConteudo cartoes={cartoes} linhas={linhas} />
    </Box>
  );
}
