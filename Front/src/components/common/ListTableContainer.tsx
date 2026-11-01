import { Paper, TableContainer, type TableContainerProps } from "@mui/material";

const TABLE_HEADER_HEIGHT = 56;
const TABLE_ROW_HEIGHT = 56;
const VISIBLE_ROWS = 10;
const TABLE_CONTAINER_HEIGHT = TABLE_HEADER_HEIGHT + TABLE_ROW_HEIGHT * VISIBLE_ROWS;
// Em telas baixas (notebook 768px) a altura fixa empurrava a paginação para fora e criava
// rolagem dentro de rolagem: a tabela acompanha a janela, sem passar das 10 linhas nem
// ficar menor que ~5 linhas.
const ALTURA = `clamp(${TABLE_HEADER_HEIGHT + TABLE_ROW_HEIGHT * 5}px, calc(100dvh - 300px), ${TABLE_CONTAINER_HEIGHT}px)`;

export default function ListTableContainer({ sx, ...props }: TableContainerProps) {
  return (
    <TableContainer
      component={Paper}
      sx={{
        borderRadius: 0,
        border: 0,
        bgcolor: 'transparent',
        height: ALTURA,
        overflowY: "auto",
        "& .MuiTableBody-root .MuiTableRow-root:only-child .MuiTableCell-root[colspan]": {
          height: `calc(${ALTURA} - ${TABLE_HEADER_HEIGHT}px)`,
          p: 0,
          verticalAlign: "middle",
        },
        ...sx,
      }}
      {...props}
    />
  );
}
