import * as React from "react";
import {
  Box, Button, Chip, CircularProgress, Fade, MenuItem, Stack, Table, TableBody, TableCell, TableHead,
  TablePagination, TableRow, TextField, Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import api from "../../../../api/api";
import { useToast } from "../../../../context/ToastContext";
import { useListaPaginada } from "../../../../hooks/useListaPaginada";
import ModuleHeader from "../../../../components/layout/ModuleHeader";
import StatCard, { StatGroup } from "../../../../components/common/StatCard";
import CampoData from "../../../../components/common/CampoData";
import EmptyState from "../../../../components/common/EmptyState";
import ListTableContainer from "../../../../components/common/ListTableContainer";
import TextoLimitado from "../../../../components/common/TextoLimitado";
import { METODO_LABEL, brl, formatarData } from "../../api/api";

/** Título pago, como vem de GET /pagamentos. */
type Movimento = {
  id: number;
  tipo: "receber" | "pagar";
  descricao?: string | null;
  categoria?: string | null;
  metodo?: string | null;
  valor_pago: number | string;
  data_pagamento: string;
  cliente?: { nome: string } | null;
  fornecedor?: { nome: string } | null;
};

type Resumo = { entradas: number; saidas: number; saldo: number; qtd_entradas: number; qtd_saidas: number };
type Tipo = "todos" | "receber" | "pagar";
type Filtros = { tipo: Tipo; de: string; ate: string };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Mês atual, entradas e saídas. */
function filtrosPadrao(hoje = new Date()): Filtros {
  return {
    tipo: "todos",
    de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
    ate: iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
  };
}

/**
 * Extrato: o dinheiro que de fato entrou e saiu no período, isto é, os títulos pagos pela data do
 * pagamento. Títulos pendentes, vencidos e cancelados não são movimento e ficam de fora; os totais
 * vêm do servidor e cobrem o período inteiro, não só a página.
 */
export default function ExtratoFinanceiro() {
  const { error } = useToast();
  const [filtros, setFiltros] = React.useState<Filtros>(() => filtrosPadrao());
  const padrao = filtrosPadrao();
  const filtrado = filtros.tipo !== padrao.tipo || filtros.de !== padrao.de || filtros.ate !== padrao.ate;
  const periodoInvalido = !!filtros.de && !!filtros.ate && filtros.de > filtros.ate;

  const periodo = React.useMemo(
    () => ({
      pagamento_de: filtros.de,
      pagamento_ate: filtros.ate,
      tz_offset: String(new Date().getTimezoneOffset()),
    }),
    [filtros.de, filtros.ate]
  );

  const { rows, total, loading, carregandoInicial, page, setPage, rowsPerPage, setRowsPerPage } =
    useListaPaginada<Movimento>("/pagamentos", {
      filtros: {
        status: "pago",
        ordem: "pagamento",
        tipo: filtros.tipo === "todos" ? "" : filtros.tipo,
        ...(periodoInvalido ? {} : periodo),
      },
      onError: (err) => {
        console.error("Erro ao carregar extrato:", err);
        error("Não foi possível carregar o extrato.");
      },
    });

  const [resumo, setResumo] = React.useState<Resumo | null>(null);
  const [resumoFalhou, setResumoFalhou] = React.useState(false);
  React.useEffect(() => {
    if (periodoInvalido) return;
    let ativo = true;
    api
      .get<Resumo>("/pagamentos/extrato/resumo", { params: periodo })
      .then(({ data }) => { if (ativo) { setResumo(data); setResumoFalhou(false); } })
      .catch((err) => {
        console.error("Erro ao carregar totais do extrato:", err);
        if (ativo) setResumoFalhou(true);
      });
    return () => { ativo = false; };
  }, [periodo, periodoInvalido]);

  const valorCard = (v: number | undefined) => (resumoFalhou || v === undefined ? "—" : brl(v));

  if (carregandoInicial) return <Box sx={{ textAlign: "center", mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>
      <ModuleHeader
        title="Extrato"
        subtitle="O dinheiro que entrou e saiu no período, pela data do pagamento."
        icon={<AccountBalanceWalletRoundedIcon />}
      />

      <StatGroup espalhar>
        <StatCard
          label="Entradas"
          value={valorCard(resumo?.entradas)}
          helper={resumo && !resumoFalhou ? `${resumo.qtd_entradas} ${resumo.qtd_entradas === 1 ? "recebimento" : "recebimentos"}` : undefined}
          icon={<ArrowDownwardRoundedIcon />}
          tone="success"
        />
        <StatCard
          label="Saídas"
          value={valorCard(resumo?.saidas)}
          helper={resumo && !resumoFalhou ? `${resumo.qtd_saidas} ${resumo.qtd_saidas === 1 ? "pagamento" : "pagamentos"}` : undefined}
          icon={<ArrowUpwardRoundedIcon />}
          tone="error"
        />
        <StatCard
          label="Saldo do período"
          value={valorCard(resumo?.saldo)}
          icon={<SavingsRoundedIcon />}
          tone={resumo && resumo.saldo < 0 ? "warning" : "primary"}
        />
      </StatGroup>

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} mb={2.5} alignItems={{ md: "flex-start" }} useFlexGap>
        <TextField
          select
          size="small"
          label="Movimento"
          value={filtros.tipo}
          onChange={(e) => setFiltros((f) => ({ ...f, tipo: e.target.value as Tipo }))}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="todos">Entradas e saídas</MenuItem>
          <MenuItem value="receber">Só entradas</MenuItem>
          <MenuItem value="pagar">Só saídas</MenuItem>
        </TextField>
        <Box sx={{ width: { xs: "100%", md: 170 } }}>
          <CampoData label="Data inicial" value={filtros.de} onChange={(v) => setFiltros((f) => ({ ...f, de: v }))} />
        </Box>
        <Box sx={{ width: { xs: "100%", md: 170 } }}>
          <CampoData
            label="Data final"
            value={filtros.ate}
            onChange={(v) => setFiltros((f) => ({ ...f, ate: v }))}
            error={periodoInvalido}
            helperText={periodoInvalido ? "Antes da data inicial" : undefined}
          />
        </Box>
        <Box sx={{ flex: 1 }} />
        {filtrado && (
          <Button size="small" onClick={() => setFiltros(filtrosPadrao())} sx={{ textTransform: "none", fontWeight: 600, alignSelf: { md: "center" } }}>
            Limpar filtros
          </Button>
        )}
      </Stack>

      <Fade in timeout={400}>
        <ListTableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Data</TableCell>
                <TableCell>Movimento</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell>Cliente / fornecedor</TableCell>
                <TableCell>Forma</TableCell>
                <TableCell align="right">Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody sx={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
              {rows.length > 0 ? rows.map((m) => {
                const entrada = m.tipo === "receber";
                return (
                  <TableRow key={m.id} hover sx={{ height: 56 }}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatarData(m.data_pagamento)}</TableCell>
                    <TableCell>
                      <Chip
                        label={entrada ? "Entrada" : "Saída"}
                        size="small"
                        sx={{
                          fontWeight: 600,
                          fontSize: 12,
                          bgcolor: (t) => alpha(entrada ? t.palette.success.main : t.palette.error.main, 0.1),
                          color: entrada ? "success.main" : "error.main",
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextoLimitado texto={m.descricao || m.categoria || "—"} linhas={2} variant="body2" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {m.cliente?.nome ?? m.fornecedor?.nome ?? "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {m.metodo ? METODO_LABEL[m.metodo] ?? m.metodo : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 700, color: entrada ? "success.main" : "error.main" }}>
                      {entrada ? "+ " : "− "}{brl(Number(m.valor_pago))}
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={6} sx={{ border: 0 }}>
                    <EmptyState
                      icon={<AccountBalanceWalletRoundedIcon />}
                      title="Nenhuma movimentação no período"
                      description="Recebimentos e pagamentos registrados aparecem aqui pela data em que foram pagos."
                      isFiltered={filtrado}
                      onClearFilter={() => setFiltros(filtrosPadrao())}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ListTableContainer>
      </Fade>

      <TablePagination
        component="div" count={total} page={page}
        onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[10, 20, 50]} labelRowsPerPage="Linhas por página:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `mais de ${to}`}`}
        sx={{ bgcolor: "transparent", borderTop: (t) => `1px solid ${t.palette.divider}` }}
      />
    </Box>
  );
}
