import * as React from "react";
import { alpha, Box, Stack, Typography } from "@mui/material";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import AssignmentLateRoundedIcon from "@mui/icons-material/AssignmentLateRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import RequestQuoteRoundedIcon from "@mui/icons-material/RequestQuoteRounded";
import PriceCheckRoundedIcon from "@mui/icons-material/PriceCheckRounded";
import MoneyOffRoundedIcon from "@mui/icons-material/MoneyOffRounded";
import BalanceRoundedIcon from "@mui/icons-material/BalanceRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import EngineeringRoundedIcon from "@mui/icons-material/EngineeringRounded";
import EventNoteRoundedIcon from "@mui/icons-material/EventNoteRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { useNavigate } from "react-router-dom";
import { paths } from "../../../routes/paths";

type Relatorio = { titulo: string; descricao: string; icone: React.ReactNode; destino: string };
type Categoria = { id: string; titulo: string; descricao: string; cor: string; icone: React.ReactNode; relatorios: Relatorio[] };

const CATEGORIAS: Categoria[] = [
  {
    id: "financeiro",
    titulo: "Financeiro",
    cor: "#2a78d6",
    descricao: "Caixa, inadimplência e resultado",
    icone: <PaidRoundedIcon />,
    relatorios: [
      { titulo: "Fluxo de caixa", descricao: "Entradas e saídas do período", icone: <AccountBalanceWalletRoundedIcon />, destino: paths.fluxoCaixaRelatorio },
      { titulo: "Inadimplência", descricao: "Contas vencidas, por faixa de atraso e por cliente", icone: <MoneyOffRoundedIcon />, destino: paths.inadimplenciaRelatorio },
      { titulo: "Resultado do mês", descricao: "Receitas, despesas e resultado do período", icone: <BalanceRoundedIcon />, destino: paths.resultadoRelatorio },
    ],
  },
  {
    id: "vendas",
    titulo: "Vendas",
    cor: "#2f9e6b",
    descricao: "Faturamento, orçamentos e margem",
    icone: <ShoppingCartRoundedIcon />,
    relatorios: [
      { titulo: "Faturamento", descricao: "OS concluídas no período e comparação com o anterior", icone: <TrendingUpRoundedIcon />, destino: paths.faturamentoRelatorio },
      { titulo: "Conversão de orçamentos", descricao: "Aprovados, perdidos e o que dá para recuperar", icone: <RequestQuoteRoundedIcon />, destino: paths.orcamentosRelatorio },
      { titulo: "Margem por OS", descricao: "Lucro bruto estimado por ordem de serviço", icone: <PriceCheckRoundedIcon />, destino: paths.margemRelatorio },
    ],
  },
  {
    id: "operacao",
    titulo: "Operação",
    cor: "#eb6834",
    descricao: "Ordens, mecânicos e agenda",
    icone: <BuildRoundedIcon />,
    relatorios: [
      { titulo: "Ordens de serviço", descricao: "Abertas, paradas e valor preso", icone: <AssignmentLateRoundedIcon />, destino: paths.ordensRelatorio },
      { titulo: "Desempenho por mecânico", descricao: "Ordens, faturamento, ticket médio e margem de cada um", icone: <EngineeringRoundedIcon />, destino: paths.mecanicosRelatorio },
      { titulo: "Agenda", descricao: "Agendamentos do período", icone: <EventNoteRoundedIcon />, destino: paths.agendaRelatorio },
    ],
  },
  {
    id: "estoque-clientes",
    titulo: "Estoque e clientes",
    cor: "#7c5cd6",
    descricao: "Posição de estoque e base de clientes",
    icone: <Inventory2RoundedIcon />,
    relatorios: [
      { titulo: "Posição de estoque", descricao: "Valor em estoque, compra urgente e preços", icone: <Inventory2RoundedIcon />, destino: paths.estoqueRelatorio },
      { titulo: "Clientes", descricao: "Cadastro e histórico de clientes", icone: <GroupsRoundedIcon />, destino: paths.clientesRelatorio },
    ],
  },
];

function IconeColorido({ cor, tamanho, children }: { cor: string; tamanho: number; children: React.ReactNode }) {
  return (
    <Box sx={{ width: tamanho, height: tamanho, flexShrink: 0, borderRadius: 2.5, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: alpha(cor, 0.14), color: cor, "& svg": { fontSize: tamanho * 0.52 } }}>
      {children}
    </Box>
  );
}

function CardCategoria({ categoria, selecionada, onClick }: { categoria: Categoria; selecionada: boolean; onClick: () => void }) {
  const qtd = categoria.relatorios.length;
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={selecionada}
      sx={{
        font: "inherit",
        color: "text.primary",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        bgcolor: selecionada ? alpha(categoria.cor, 0.08) : "transparent",
        border: "1px solid",
        borderColor: selecionada ? categoria.cor : "divider",
        borderRadius: 3,
        p: 2.5,
        display: "flex",
        alignItems: "center",
        gap: 2,
        transition: "border-color 0.15s, background-color 0.15s",
        "&:hover": { borderColor: categoria.cor },
      }}
    >
      <IconeColorido cor={categoria.cor} tamanho={56}>{categoria.icone}</IconeColorido>
      <Stack flex={1} minWidth={0} spacing={0.25}>
        <Typography fontWeight={700} fontSize={16}>{categoria.titulo}</Typography>
        <Typography variant="body2" color="text.secondary">{categoria.descricao}</Typography>
        <Typography variant="caption" fontWeight={600} sx={{ color: categoria.cor }}>{qtd} {qtd === 1 ? "relatório" : "relatórios"}</Typography>
      </Stack>
    </Box>
  );
}

function CardRelatorio({ relatorio, cor, onClick }: { relatorio: Relatorio; cor: string; onClick: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        font: "inherit",
        color: "text.primary",
        cursor: "pointer",
        textAlign: "left",
        bgcolor: "transparent",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
        p: 3,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minHeight: 170,
        transition: "border-color 0.15s, transform 0.15s",
        "&:hover": { borderColor: cor, transform: "translateY(-2px)" },
      }}
    >
      <IconeColorido cor={cor} tamanho={52}>{relatorio.icone}</IconeColorido>
      <Stack spacing={0.5} flex={1}>
        <Typography fontWeight={700} fontSize={16}>{relatorio.titulo}</Typography>
        <Typography variant="body2" color="text.secondary">{relatorio.descricao}</Typography>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: cor, fontWeight: 600, fontSize: 13 }}>
        <span>Abrir</span>
        <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
      </Stack>
    </Box>
  );
}

export default function Relatorios() {
  const nav = useNavigate();
  const [aberta, setAberta] = React.useState(CATEGORIAS[0].id);
  const categoria = CATEGORIAS.find((c) => c.id === aberta) ?? CATEGORIAS[0];

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>
      <Stack spacing={0.5} mb={4}>
        <Typography variant="h5" fontWeight={700}>Relatórios</Typography>
        <Typography variant="body2" color="text.secondary">
          Acompanhe o caixa, as vendas, a operação da oficina e o estoque.
        </Typography>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "320px 1fr" }, gap: { xs: 3, md: 5 }, alignItems: "start" }}>
        <Stack spacing={1.5}>
          {CATEGORIAS.map((c) => (
            <CardCategoria key={c.id} categoria={c} selecionada={aberta === c.id} onClick={() => setAberta(c.id)} />
          ))}
        </Stack>

        <Box key={categoria.id} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "repeat(3, 1fr)" }, gap: 2 }}>
          {categoria.relatorios.map((r) => (
            <CardRelatorio key={r.destino} relatorio={r} cor={categoria.cor} onClick={() => nav(r.destino)} />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
