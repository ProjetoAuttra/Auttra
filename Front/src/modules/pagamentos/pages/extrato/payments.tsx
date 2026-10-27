import * as React from "react";
import {
  Box, Stack, Typography, Paper, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Fade, Divider, TablePagination, CircularProgress
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import CalendarTodayRoundedIcon from "@mui/icons-material/CalendarTodayRounded";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import ModuleHeader from "../../../../components/layout/ModuleHeader";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";

type Transacao = {
  id: number;
  tipo: "entrada" | "saida";
  descricao: string;
  valor: number;
  data: string;
  responsavel?: string;
  categoria?: string;
};

export default function ExtratoFinanceiro() {
  const { user } = useAuth();
  const [transacoes, setTransacoes] = React.useState<Transacao[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filtroTipo, setFiltroTipo] = React.useState<"todos" | "entrada" | "saida">("todos");
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(8);

  React.useEffect(() => {
    if (!user?.oficina_id) return;

    (async () => {
      try {
        const { data } = await api.get(`/pagamentos?oficina_id=${user.oficina_id}`);
        const mapped = data.map((p: any) => ({
          id: p.id,
          tipo: p.tipo === "receber" ? "entrada" : "saida",
          descricao: p.descricao ?? "—",
          valor: Number(p.valor),
          data: p.data_pagamento || p.data_vencimento,
          responsavel: p.cliente?.nome ?? p.fornecedor?.nome ?? "—",
          categoria: p.metodo ?? "Outros",
        }));
        setTransacoes(mapped);
      } catch (err) {
        console.error("Erro ao carregar extrato:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.oficina_id]);

  const transacoesFiltradas = transacoes.filter((t) => {
    const matchTipo = filtroTipo === "todos" || t.tipo === filtroTipo;
    return matchTipo;
  });

  const totalEntradas = transacoesFiltradas
    .filter((t) => t.tipo === "entrada")
    .reduce((total, t) => total + t.valor, 0);

  const totalSaidas = transacoesFiltradas
    .filter((t) => t.tipo === "saida")
    .reduce((total, t) => total + t.valor, 0);

  const saldo = totalEntradas - totalSaidas;

  const paginated = transacoesFiltradas.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const formatarData = (data: string) =>
    new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  if (loading) {
    return (
      <Box sx={{ textAlign: "center", mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>
      <ModuleHeader
        title="Extrato Financeiro"
        subtitle="Visão completa de todas as movimentações financeiras"
        icon={<AccountBalanceWalletRoundedIcon />}
      />

      {/* Filtros */}
      <Stack direction="row" spacing={1} mb={2.5} flexWrap="wrap" gap={1}>
        <Chip
          icon={<CalendarTodayRoundedIcon sx={{ fontSize: 16 }} />}
          label="Todos"
          onClick={() => setFiltroTipo("todos")}
          sx={{
            fontWeight: 600,
            bgcolor: filtroTipo === "todos" ? (t) => alpha(t.palette.primary.main, 0.1) : "transparent",
            color: filtroTipo === "todos" ? "primary.main" : "text.secondary",
            border: (t) => `1px solid ${t.palette.divider}`,
          }}
        />
        <Chip
          icon={<ArrowDownwardRoundedIcon sx={{ fontSize: 16 }} />}
          label="Entradas"
          onClick={() => setFiltroTipo("entrada")}
          sx={{
            fontWeight: 600,
            bgcolor: filtroTipo === "entrada" ? (t) => alpha(t.palette.success.main, 0.1) : "transparent",
            color: filtroTipo === "entrada" ? "success.main" : "text.secondary",
            border: (t) => `1px solid ${t.palette.divider}`,
          }}
        />
        <Chip
          icon={<ArrowUpwardRoundedIcon sx={{ fontSize: 16 }} />}
          label="Saídas"
          onClick={() => setFiltroTipo("saida")}
          sx={{
            fontWeight: 600,
            bgcolor: filtroTipo === "saida" ? (t) => alpha(t.palette.error.main, 0.1) : "transparent",
            color: filtroTipo === "saida" ? "error.main" : "text.secondary",
            border: (t) => `1px solid ${t.palette.divider}`,
          }}
        />
      </Stack>

      {/* Tabela */}
      <Fade in timeout={500}>
        <TableContainer component={Paper} sx={{ borderRadius: 0, border: 0 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>DATA</TableCell>
                <TableCell>TIPO</TableCell>
                <TableCell>DESCRIÇÃO</TableCell>
                <TableCell>CATEGORIA</TableCell>
                <TableCell>RESPONSÁVEL</TableCell>
                <TableCell align="right">VALOR</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell>{formatarData(t.data)}</TableCell>
                  <TableCell>
                    <Chip
                      label={t.tipo === "entrada" ? "Entrada" : "Saída"}
                      size="small"
                      sx={{
                        bgcolor: t.tipo === "entrada"
                          ? (th) => alpha(th.palette.success.main, 0.1)
                          : (th) => alpha(th.palette.error.main, 0.1),
                        color: t.tipo === "entrada" ? "success.main" : "error.main",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    />
                  </TableCell>
                  <TableCell>{t.descricao}</TableCell>
                  <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{t.categoria}</TableCell>
                  <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{t.responsavel}</TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, color: t.tipo === "entrada" ? "success.main" : "error.main" }}
                  >
                    {t.tipo === "entrada" ? "+" : "-"} R$ {t.valor.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination
            component="div"
            count={transacoesFiltradas.length}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 20]}
            labelRowsPerPage="Linhas por página:"
            labelDisplayedRows={({ from, to, count }) =>
              `${from}–${to} de ${count !== -1 ? count : `mais de ${to}`}`
            }
          />

          <Box sx={{ p: 2.5, bgcolor: (t) => alpha(t.palette.action.hover, 0.05) }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
              <Typography variant="body2" fontWeight={600} color="text.secondary">
                Total de transações: {transacoesFiltradas.length}
              </Typography>
              <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap" gap={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" fontWeight={600} color="text.secondary">
                    Entradas:
                  </Typography>
                  <Typography variant="body2" fontWeight={600} color="success.main">
                    + R$ {totalEntradas.toFixed(2)}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" fontWeight={600} color="text.secondary">
                    Saídas:
                  </Typography>
                  <Typography variant="body2" fontWeight={600} color="error.main">
                    - R$ {totalSaidas.toFixed(2)}
                  </Typography>
                </Stack>
                <Divider orientation="vertical" flexItem />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" fontWeight={600} color="text.primary">
                    Saldo:
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color={saldo >= 0 ? "primary.main" : "warning.main"}>
                    R$ {saldo.toFixed(2)}
                  </Typography>
                </Stack>
              </Stack>
            </Stack>
          </Box>
        </TableContainer>
      </Fade>
    </Box>
  );
}
