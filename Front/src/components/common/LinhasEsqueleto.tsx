import { Skeleton, TableCell, TableRow } from "@mui/material";

// Larguras fixas (e não aleatórias) para o esqueleto não "pular" a cada renderização.
const LARGURAS = ["70%", "55%", "80%", "45%", "65%", "60%", "50%"];

/**
 * Linhas no formato da tabela enquanto a lista carrega: o cabeçalho, a busca e os botões da tela
 * já aparecem de verdade, e só o corpo da tabela espera os dados.
 */
export default function LinhasEsqueleto({ colunas, linhas = 8 }: { colunas: number; linhas?: number }) {
  return (
    <>
      {Array.from({ length: linhas }).map((_, l) => (
        <TableRow key={l} role="presentation" sx={{ height: 56 }}>
          {Array.from({ length: colunas }).map((_, c) => (
            <TableCell key={c}>
              <Skeleton variant="text" height={20} width={LARGURAS[(l + c) % LARGURAS.length]} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
