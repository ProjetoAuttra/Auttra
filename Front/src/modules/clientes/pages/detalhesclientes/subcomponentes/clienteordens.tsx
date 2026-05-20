import {
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Typography, Paper, Chip, Box,
} from "@mui/material";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";

const STATUS_OS: Record<string, { label: string; color: "warning" | "info" | "success" | "error" }> = {
  aberta:       { label: "Aberta",       color: "warning" },
  em_andamento: { label: "Em andamento", color: "info"    },
  concluida:    { label: "Concluída",    color: "success" },
  cancelada:    { label: "Cancelada",    color: "error"   },
};

const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ClienteOrdens({ ordens }: { ordens: any[] }) {
  if (!ordens?.length) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <AssignmentRoundedIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
        <Typography color="text.disabled">Nenhuma ordem de serviço encontrada</Typography>
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
            <TableCell>Mecânico</TableCell>
            <TableCell>Data</TableCell>
            <TableCell>Total</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ordens.map((o) => {
            const st = STATUS_OS[o.status] ?? STATUS_OS.aberta;
            return (
              <TableRow key={o.id} hover>
                <TableCell>
                  <Typography variant="body2">
                    {o.veiculo ? `${o.veiculo.marca} ${o.veiculo.modelo}` : "—"}
                  </Typography>
                  {o.veiculo?.placa && (
                    <Typography variant="caption" fontFamily="monospace" fontWeight={700}
                      sx={{ px: 0.5, borderRadius: 0.5, bgcolor: (t) => t.palette.action.hover }}>
                      {o.veiculo.placa}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{o.funcionario?.nome ?? "—"}</TableCell>
                <TableCell>
                  {o.data_abertura ? new Date(o.data_abertura).toLocaleDateString("pt-BR") : "—"}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={600} color="success.main">
                    {brl(o.valor_total ?? 0)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={st.label} size="small" color={st.color} sx={{ fontWeight: 700, fontSize: 11 }} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
