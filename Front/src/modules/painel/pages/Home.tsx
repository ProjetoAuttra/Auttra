import * as React from "react";
import { Box, Grid, Paper, Stack, Typography } from "@mui/material";
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

// ─── Cores do sistema ─────────────────────────────────────────────────────────

const PRIMARY  = "#1D4ED8";
const INK      = "#18202F";
const MUTED    = "#667085";
const SURFACE  = "#FFFFFF";
const LINE     = "#DDE3EA";
const ICON_BG  = "#EEF2FF";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function saudacao(nome: string): string {
  const h = new Date().getHours();
  const turno = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return `${turno}, ${nome.split(" ")[0]}`;
}

function hojeLabel(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ─── Card de atalho ───────────────────────────────────────────────────────────

interface ShortcutProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}

function ShortcutCard({ icon, title, subtitle, onClick }: ShortcutProps) {
  return (
    <Paper
      component="button"
      onClick={onClick}
      elevation={0}
      sx={{
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        background: SURFACE,
        border: `0.5px solid ${LINE}`,
        borderRadius: "16px",
        p: "1.75rem 1.5rem",
        display: "flex",
        gap: 2,
        alignItems: "flex-start",
        transition: "border-color 0.15s",
        "&:hover": { borderColor: PRIMARY },
        fontFamily: "inherit",
        outline: "none",
        appearance: "none",
        WebkitAppearance: "none",
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: "10px",
          bgcolor: ICON_BG,
          color: PRIMARY,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Stack spacing={0.25} sx={{ pt: 0.25 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 500, color: INK, lineHeight: 1.3 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 12, color: MUTED, lineHeight: 1.4 }}>
          {subtitle}
        </Typography>
      </Stack>
    </Paper>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function Home() {
  const { user } = useAuth();

  const [openOS,      setOpenOS]      = React.useState(false);
  const [openOrc,     setOpenOrc]     = React.useState(false);
  const [openCliente, setOpenCliente] = React.useState(false);
  const [openVeiculo, setOpenVeiculo] = React.useState(false);

  const shortcuts: ShortcutProps[] = [
    {
      icon:     <AssignmentRoundedIcon fontSize="small" />,
      title:    "Nova O.S.",
      subtitle: "Abrir ordem de serviço",
      onClick:  () => setOpenOS(true),
    },
    {
      icon:     <RequestQuoteRoundedIcon fontSize="small" />,
      title:    "Novo orçamento",
      subtitle: "Criar e enviar proposta",
      onClick:  () => setOpenOrc(true),
    },
    {
      icon:     <PersonAddRoundedIcon fontSize="small" />,
      title:    "Cadastrar cliente",
      subtitle: "Adicionar novo cliente",
      onClick:  () => setOpenCliente(true),
    },
    {
      icon:     <DirectionsCarRoundedIcon fontSize="small" />,
      title:    "Cadastrar veículo",
      subtitle: "Vincular a um cliente",
      onClick:  () => setOpenVeiculo(true),
    },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        py: { xs: 6, md: 10 },
      }}
    >
      <Stack spacing={4} alignItems="center" sx={{ width: "100%", maxWidth: 480 }}>

        {/* Saudação */}
        <Stack spacing={0.5} alignItems="center" sx={{ textAlign: "center" }}>
          <Typography sx={{ fontSize: 28, fontWeight: 500, color: INK, lineHeight: 1.2 }}>
            {saudacao(user?.nome ?? "Usuário")}
          </Typography>
          <Typography sx={{ fontSize: 15, color: MUTED }}>
            {hojeLabel()}
            {user?.oficina_nome ? ` · ${user.oficina_nome}` : ""}
          </Typography>
        </Stack>

        {/* Grade 2×2 */}
        <Grid container spacing={2} sx={{ width: "100%" }}>
          {shortcuts.map((s) => (
            <Grid key={s.title} size={{ xs: 12, sm: 6 }}>
              <ShortcutCard {...s} />
            </Grid>
          ))}
        </Grid>
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
