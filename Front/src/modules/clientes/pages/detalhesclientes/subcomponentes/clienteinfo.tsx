import {
  Paper, Stack, Typography, Avatar, IconButton, Tooltip,
} from "@mui/material";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";

type Props = {
  cliente: any;
  onEditar: () => void;
};

export default function ClienteHeaderCard({ cliente, onEditar }: Props) {
  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: (t) => `1px solid ${t.palette.divider}` }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
        <Stack direction="row" spacing={2}>
          <Avatar sx={{ bgcolor: "primary.main", width: 64, height: 64, fontSize: 24, fontWeight: 700 }}>
            {cliente.nome?.[0]?.toUpperCase()}
          </Avatar>
          <Stack spacing={0.5}>
            <Typography variant="h6" fontWeight={700}>{cliente.nome}</Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <EmailRoundedIcon sx={{ fontSize: 15, color: "text.disabled" }} />
              <Typography variant="body2" color="text.secondary">{cliente.email || "Sem e-mail"}</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <PhoneRoundedIcon sx={{ fontSize: 15, color: "text.disabled" }} />
              <Typography variant="body2" color="text.secondary">{cliente.telefone || "Sem telefone"}</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <BadgeRoundedIcon sx={{ fontSize: 15, color: "text.disabled" }} />
              <Typography variant="body2" color="text.secondary">{cliente.cpf || "Sem CPF"}</Typography>
            </Stack>
          </Stack>
        </Stack>
        <Tooltip title="Editar cliente">
          <IconButton onClick={onEditar}>
            <EditRoundedIcon />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
