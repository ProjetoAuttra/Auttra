import { Paper, TableContainer, type TableContainerProps } from "@mui/material";

const TABLE_HEADER_HEIGHT = 56;
const TABLE_ROW_HEIGHT = 56;
const VISIBLE_ROWS = 10;
const TABLE_CONTAINER_HEIGHT = TABLE_HEADER_HEIGHT + TABLE_ROW_HEIGHT * VISIBLE_ROWS;

export default function ListTableContainer({ sx, ...props }: TableContainerProps) {
  return (
    <TableContainer
      component={Paper}
      sx={{
        borderRadius: 0,
        border: 0,
        bgcolor: 'transparent',
        height: TABLE_CONTAINER_HEIGHT,
        overflowY: "auto",
        "& .MuiTableBody-root .MuiTableRow-root:only-child .MuiTableCell-root[colspan]": {
          height: TABLE_ROW_HEIGHT * VISIBLE_ROWS,
          p: 0,
          verticalAlign: "middle",
        },
        ...sx,
      }}
      {...props}
    />
  );
}
