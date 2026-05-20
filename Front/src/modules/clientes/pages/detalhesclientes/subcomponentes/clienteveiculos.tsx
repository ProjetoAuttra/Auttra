import {
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Typography, Paper, Avatar, Box,
} from "@mui/material";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";

export default function ClienteVeiculos({ veiculos }: { veiculos: any[] }) {
  if (!veiculos?.length) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <DirectionsCarRoundedIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
        <Typography color="text.disabled">Nenhum veículo cadastrado</Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} elevation={0}
      sx={{ border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Veículo</TableCell>
            <TableCell>Placa</TableCell>
            <TableCell>Ano</TableCell>
            <TableCell>Cor</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {veiculos.map((v) => (
            <TableRow key={v.id} hover>
              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Avatar sx={{ bgcolor: (t) => t.palette.primary.main, width: 32, height: 32 }}>
                    <DirectionsCarRoundedIcon fontSize="small" />
                  </Avatar>
                  <Typography variant="body2" fontWeight={600}>{v.marca} {v.modelo}</Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant="body2" fontFamily="monospace" fontWeight={700}>{v.placa || "—"}</Typography>
              </TableCell>
              <TableCell>{v.ano || "—"}</TableCell>
              <TableCell>{v.cor || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
