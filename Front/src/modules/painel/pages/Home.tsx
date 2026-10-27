import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Menu, MenuItem, ListItemIcon, Stack, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import RequestQuoteRoundedIcon from "@mui/icons-material/RequestQuoteRounded";

import DialogAgendamento from "../../tarefas/dialog/";
import DialogCarro from "../../veiculos/dialog/";
import DialogCliente from "../../clientes/dialog/";
import DialogOrcamento from "../../orcamentos/dialog/";
import { useAuth } from "../../../context/AuthContext";
import api from "../../../api/api";
import { brand } from "../../../app/theme";
import { paths } from "../../../routes/paths";

const INK   = brand.ink;
const MUTED = brand.muted;

// ─── MOCK: dados fictícios só para avaliar o layout (trocar por GET /painel/resumo) ───

const MOCK_RESUMO = "12 ordens em andamento · 6 agendamentos hoje";

const MOCK_ATENCAO = [
  { titulo: "3 O.S. paradas há mais de 5 dias", to: paths.ordensRelatorio },
  { titulo: "2 contas vencidas a receber",      to: paths.contasReceber },
  { titulo: "4 orçamentos sem resposta",        to: paths.orcamentos },
];

const MOCK_AGENDA = [
  { hora: "09:00", texto: "João Pereira · Honda Civic" },
  { hora: "10:30", texto: "Maria Souza · Chevrolet Onix" },
  { hora: "13:00", texto: "Carlos Lima · VW Gol" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function saudacao(nome: string): string {
  const h = new Date().getHours();
  const turno = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return `${turno}, ${nome.split(" ")[0]}`;
}

function Section({ title, to, children }: { title: string; to: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: MUTED }}>{title}</Typography>
        <Typography
          component="button"
          onClick={() => navigate(to)}
          sx={{ fontSize: 13, color: brand.primary, background: "none", border: 0, p: 0, cursor: "pointer", fontFamily: "inherit", "&:hover": { textDecoration: "underline" } }}
        >
          Ver tudo
        </Typography>
      </Stack>
      {children}
    </Box>
  );
}

const rowSx = {
  display: "flex", alignItems: "center", gap: 2, py: 1.5, width: "100%", textAlign: "left",
  border: 0, borderBottom: `1px solid ${brand.line}`, background: "transparent",
  fontFamily: "inherit", color: INK, fontSize: 15,
} as const;

// ─── Página ───────────────────────────────────────────────────────────────────

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [openOS,      setOpenOS]      = React.useState(false);
  const [openOrc,     setOpenOrc]     = React.useState(false);
  const [openCliente, setOpenCliente] = React.useState(false);
  const [openVeiculo, setOpenVeiculo] = React.useState(false);
  const [menuEl,      setMenuEl]      = React.useState<HTMLElement | null>(null);

  const novos = [
    { icon: <AssignmentRoundedIcon fontSize="small" />,    label: "Nova O.S.",           onClick: () => setOpenOS(true) },
    { icon: <RequestQuoteRoundedIcon fontSize="small" />,  label: "Novo orçamento",      onClick: () => setOpenOrc(true) },
    { icon: <PersonAddRoundedIcon fontSize="small" />,     label: "Cadastrar cliente",   onClick: () => setOpenCliente(true) },
    { icon: <DirectionsCarRoundedIcon fontSize="small" />, label: "Cadastrar veículo",   onClick: () => setOpenVeiculo(true) },
  ];

  return (
    <Box sx={{ py: { xs: 3, md: 6 }, maxWidth: 720, mx: "auto" }}>
      <Stack spacing={6}>

        {/* Cabeçalho */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Stack spacing={0.5}>
            <Typography sx={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: INK, lineHeight: 1.2 }}>
              {saudacao(user?.nome ?? "Usuário")}
            </Typography>
            <Typography sx={{ fontSize: 15, color: MUTED }}>{MOCK_RESUMO}</Typography>
          </Stack>
          <Button variant="contained" disableElevation startIcon={<AddRoundedIcon />} onClick={(e) => setMenuEl(e.currentTarget)}>
            Novo
          </Button>
          <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
            {novos.map((n) => (
              <MenuItem key={n.label} onClick={() => { setMenuEl(null); n.onClick(); }}>
                <ListItemIcon>{n.icon}</ListItemIcon>
                {n.label}
              </MenuItem>
            ))}
          </Menu>
        </Stack>

        <Section title="Precisa de atenção" to={paths.ordensRelatorio}>
          {MOCK_ATENCAO.map((a) => (
            <Box key={a.titulo} component="button" onClick={() => navigate(a.to)} sx={{ ...rowSx, cursor: "pointer", "&:hover": { background: brand.subtle } }}>
              <Box sx={{ flex: 1 }}>{a.titulo}</Box>
              <ChevronRightRoundedIcon fontSize="small" sx={{ color: MUTED }} />
            </Box>
          ))}
        </Section>

        <Section title="Agenda de hoje" to={paths.agenda}>
          {MOCK_AGENDA.map((a) => (
            <Box key={a.hora} sx={rowSx}>
              <Box sx={{ width: 48, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{a.hora}</Box>
              <Box sx={{ flex: 1 }}>{a.texto}</Box>
            </Box>
          ))}
        </Section>
      </Stack>

      {/* Dialogs */}
      <DialogAgendamento
        open={openOS}
        onClose={() => setOpenOS(false)}
        onSubmit={async (data: any) => {
          try { await api.post("/ordens", data); } catch (err) { console.error(err); }
          setOpenOS(false);
        }}
      />
      <DialogCarro
        open={openVeiculo}
        mode="create"
        onClose={() => setOpenVeiculo(false)}
        onSubmit={() => setOpenVeiculo(false)}
      />
      <DialogCliente
        open={openCliente}
        mode="create"
        onClose={() => setOpenCliente(false)}
        onSubmit={() => setOpenCliente(false)}
      />
      <DialogOrcamento
        open={openOrc}
        mode="create"
        onClose={() => setOpenOrc(false)}
        onSubmit={async (data: any) => {
          try { await api.post("/orcamentos", data); } catch (err) { console.error(err); }
          setOpenOrc(false);
        }}
      />
    </Box>
  );
}
