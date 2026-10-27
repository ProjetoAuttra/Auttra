import * as React from "react";
import { Box, Stack, Typography } from "@mui/material";
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
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { useNavigate } from "react-router-dom";
import { paths } from "../../../routes/paths";

type Relatorio = { titulo: string; descricao: string; icone: React.ReactNode; destino: string };
type Categoria = { id: string; titulo: string; icone: React.ReactNode; relatorios: Relatorio[] };

const CATEGORIAS: Categoria[] = [
  {
    id: "financeiro",
    titulo: "Financeiro",
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
    icone: <Inventory2RoundedIcon />,
    relatorios: [
      { titulo: "Posição de estoque", descricao: "Valor em estoque, compra urgente e preços", icone: <Inventory2RoundedIcon />, destino: paths.estoqueRelatorio },
      { titulo: "Clientes", descricao: "Cadastro e histórico de clientes", icone: <GroupsRoundedIcon />, destino: paths.clientesRelatorio },
    ],
  },
];

function CardCategoria({ categoria, selecionada, onClick }: { categoria: Categoria; selecionada: boolean; onClick: () => void }) {
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
        textAlign: "center",
        bgcolor: selecionada ? "action.hover" : "transparent",
        border: "1px solid",
        borderColor: selecionada ? "primary.main" : "divider",
        borderRadius: 2,
        py: 4,
        px: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
        transition: "border-color 0.15s, background-color 0.15s",
        "&:hover": { borderColor: "primary.main" },
        "& svg": { fontSize: 36, color: selecionada ? "primary.main" : "text.secondary" },
      }}
    >
      {categoria.icone}
      <Typography fontWeight={700} fontSize={16}>{categoria.titulo}</Typography>
    </Box>
  );
}

export default function Relatorios() {
  const nav = useNavigate();
  const [aberta, setAberta] = React.useState<string | null>(null);
  const categoria = CATEGORIAS.find((c) => c.id === aberta);

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>
      <Stack spacing={0.5} mb={4}>
        <Typography variant="h5" fontWeight={700}>Relatórios</Typography>
        <Typography variant="body2" color="text.secondary">
          Acompanhe o caixa, as vendas, a operação da oficina e o estoque.
        </Typography>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2, mb: 4 }}>
        {CATEGORIAS.map((c) => (
          <CardCategoria
            key={c.id}
            categoria={c}
            selecionada={aberta === c.id}
            onClick={() => setAberta((atual) => (atual === c.id ? null : c.id))}
          />
        ))}
      </Box>

      {categoria ? (
        <Box>
          {categoria.relatorios.map((r) => (
            <Box
              key={r.destino}
              component="button"
              type="button"
              onClick={() => nav(r.destino)}
              sx={{
                font: "inherit",
                color: "text.primary",
                cursor: "pointer",
                width: "100%",
                textAlign: "left",
                bgcolor: "transparent",
                border: 0,
                borderBottom: "1px solid",
                borderColor: "divider",
                py: 2,
                display: "flex",
                alignItems: "center",
                gap: 2,
                "&:hover": { bgcolor: "action.hover" },
                "& .icone": { display: "flex", color: "text.secondary" },
              }}
            >
              <span className="icone">{r.icone}</span>
              <Stack flex={1} minWidth={0} spacing={0.25}>
                <Typography fontWeight={600} fontSize={15}>{r.titulo}</Typography>
                <Typography variant="body2" color="text.secondary">{r.descricao}</Typography>
              </Stack>
              <ChevronRightRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} />
            </Box>
          ))}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">Escolha uma categoria para ver os relatórios.</Typography>
      )}
    </Box>
  );
}
