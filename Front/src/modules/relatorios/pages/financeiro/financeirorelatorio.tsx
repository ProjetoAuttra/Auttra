import * as React from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import { buscarTodas, somarDias } from "../../shared/buscarTodas";
import { METODO_FILTRO_OPTIONS, METODO_LABEL, METODO_OPTIONS, rotuloMetodo } from "../../../pagamentos/api/api";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../context/ToastContext";
import {
  brl,
  dateBr,
  EmptyReport,
  exportCsv,
  periodoMesAtual,
  inDateRange,
  MetricCard,
  StatGroup,
  ReportHeader,
  ReportPage,
  todayISO, TituloSecao } from "../../shared/reportUtils";
import BarraFiltros, { type CampoFiltro } from "../../../../components/common/BarraFiltros";
import { GraficoPizza, GraficoEntradasSaidas, chaveSemana, rotuloSemana, semanasDoPeriodo } from "../../shared/graficos";
import EsqueletoPagina from "../../../../components/common/EsqueletoPagina";

type Pagamento = {
  id: number;
  tipo: "pagar" | "receber" | string;
  metodo?: string | null;
  valor: number;
  valor_pago?: number | null;
  status?: string | null;
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  categoria?: string | null;
  descricao?: string | null;
  cliente?: { nome?: string | null } | null;
  fornecedor?: { nome?: string | null } | null;
  valor_taxa?: number | null;
  cartao_parcelas?: number | null;
  maquininha?: { id: number; nome: string } | null;
};

const isReceber = (p: Pagamento) => p.tipo === "receber" || p.tipo === "entrada";
const isPagar = (p: Pagamento) => p.tipo === "pagar" || p.tipo === "saida";
const isPago = (p: Pagamento) => p.status === "pago";
const isPendente = (p: Pagamento) => p.status === "pendente" || p.status === "parcial";
const valorPago = (p: Pagamento) => Number(p.valor_pago ?? 0) || (isPago(p) ? Number(p.valor ?? 0) : 0);
const valorAberto = (p: Pagamento) => Math.max(0, Number(p.valor ?? 0) - Number(p.valor_pago ?? 0));
const dataReferencia = (p: Pagamento) => p.data_pagamento ?? p.data_vencimento;
/** Taxa de cartão já descontada de um recebimento pago (zero nos demais). */
const taxaDe = (p: Pagamento) => (isReceber(p) && isPago(p) ? Number(p.valor_taxa ?? 0) : 0);

type FiltrosFluxo = { de: string; ate: string; tipo: string; situacao: string[]; metodos: string[]; maquininhas: string[]; parceiros: string[] };
const PADRAO: FiltrosFluxo = { ...periodoMesAtual(), tipo: "", situacao: [], metodos: [], maquininhas: [], parceiros: [] };

const nomeParceiro = (p: Pagamento) => p.cliente?.nome ?? p.fornecedor?.nome ?? "";

export default function RelatorioFinanceiro() {
  const { user } = useAuth();
  const { warning, error } = useToast();
  const [filtros, setFiltros] = React.useState(PADRAO);
  const { de: dataInicio, ate: dataFim } = filtros;
  const [dados, setDados] = React.useState<Pagamento[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user?.oficina_id) return;
    let vivo = true;

    (async () => {
      try {
        // A listagem sem paginação para em 200 títulos (por vencimento, do mais distante), e parcelas futuras
        // deixavam os títulos do mês de fora. Busca todas as páginas, já filtrando o período no servidor:
        // os pagos no período (data do pagamento) e os que vencem no período (os em aberto entram por aqui).
        // A janela de vencimento tem um dia de folga; o dia exato é conferido abaixo com inDateRange.
        const [pagosNoPeriodo, vencendoNoPeriodo] = await Promise.all([
          buscarTodas<any>("/pagamentos", {
            pagamento_de: dataInicio,
            pagamento_ate: dataFim,
            tz_offset: String(new Date().getTimezoneOffset()),
          }),
          buscarTodas<any>("/pagamentos", { vencimento_de: somarDias(dataInicio, -1), vencimento_ate: somarDias(dataFim, 1) }),
        ]);
        if (!vivo) return;
        const porId = new Map<number, any>();
        for (const p of [...pagosNoPeriodo, ...vencendoNoPeriodo]) porId.set(p.id, p);
        setDados([...porId.values()].map((p: any) => ({
          ...p,
          valor: Number(p.valor ?? 0),
          valor_pago: Number(p.valor_pago ?? 0),
          valor_taxa: Number(p.valor_taxa ?? 0),
          tipo: (p.tipo ?? "").toLowerCase(),
          status: (p.status ?? "").toLowerCase(),
        })));
      } catch (err) {
        console.error("Erro ao carregar pagamentos:", err);
        if (vivo) error("Não foi possível carregar o relatório financeiro.");
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => { vivo = false; };
  }, [user?.oficina_id, dataInicio, dataFim, error]);

  const hoje = new Date(`${todayISO()}T23:59:59`);
  const vencida = (p: Pagamento) => isPendente(p) && !!p.data_vencimento && new Date(p.data_vencimento) < hoje;

  const filtrados = React.useMemo(
    () =>
      dados.filter((p) => {
        if (!inDateRange(dataReferencia(p), dataInicio, dataFim)) return false;
        if (filtros.tipo === "receber" && !isReceber(p)) return false;
        if (filtros.tipo === "pagar" && !isPagar(p)) return false;
        if (filtros.metodos.length && !filtros.metodos.includes(p.metodo ?? "")) return false;
        if (filtros.maquininhas.length && !filtros.maquininhas.includes(String(p.maquininha?.id ?? ""))) return false;
        if (filtros.parceiros.length && !filtros.parceiros.includes(nomeParceiro(p))) return false;
        if (filtros.situacao.length) {
          const bate = filtros.situacao.some((s) => (s === "vencido" ? vencida(p) : s === "pendente" ? isPendente(p) && !vencida(p) : p.status === s));
          if (!bate) return false;
        }
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dados, filtros]
  );

  const parceirosOpcoes = React.useMemo(
    () => [...new Set(dados.map(nomeParceiro).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")).map((n) => ({ value: n, label: n })),
    [dados]
  );
  const maquininhasOpcoes = React.useMemo(() => {
    const porId = new Map<number, string>();
    for (const p of dados) if (p.maquininha) porId.set(p.maquininha.id, p.maquininha.nome);
    return [...porId].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")).map(([id, nome]) => ({ value: String(id), label: nome }));
  }, [dados]);
  const campos: CampoFiltro<FiltrosFluxo>[] = [
    { id: "tipo", label: "Tipo", opcoes: [{ value: "receber", label: "Entradas (a receber)" }, { value: "pagar", label: "Saídas (a pagar)" }] },
    {
      id: "situacao",
      label: "Situação",
      multi: true,
      vazio: "Todas as situações",
      opcoes: [{ value: "pendente", label: "Pendentes" }, { value: "vencido", label: "Vencidos" }, { value: "pago", label: "Pagos" }, { value: "cancelado", label: "Cancelados" }],
    },
    { id: "metodos", label: "Forma de pagamento", multi: true, vazio: "Todas", opcoes: METODO_FILTRO_OPTIONS.map((m) => ({ value: m.value, label: m.label })) },
    ...(maquininhasOpcoes.length ? [{ id: "maquininhas" as const, label: "Maquininha", multi: true, vazio: "Todas", opcoes: maquininhasOpcoes }] : []),
    { id: "parceiros", label: "Cliente/Fornecedor", multi: true, opcoes: parceirosOpcoes },
  ];

  const recebido = filtrados.filter((p) => isReceber(p) && isPago(p)).reduce((sum, p) => sum + valorPago(p), 0);
  const aReceber = filtrados.filter((p) => isReceber(p) && isPendente(p)).reduce((sum, p) => sum + valorAberto(p), 0);
  const pago = filtrados.filter((p) => isPagar(p) && isPago(p)).reduce((sum, p) => sum + valorPago(p), 0);
  const aPagar = filtrados.filter((p) => isPagar(p) && isPendente(p)).reduce((sum, p) => sum + valorAberto(p), 0);
  // A taxa da maquininha é dinheiro que não chega: sai dos saldos.
  const taxas = filtrados.reduce((sum, p) => sum + taxaDe(p), 0);
  const saldoRealizado = recebido - taxas - pago;
  const saldoProjetado = recebido - taxas + aReceber - pago - aPagar;

  const porMaquininha = React.useMemo(() => {
    const mapa = new Map<string, { nome: string; qtd: number; bruto: number; taxas: number }>();
    for (const p of filtrados) {
      if (!isReceber(p) || !isPago(p) || !p.maquininha) continue;
      const linha = mapa.get(p.maquininha.nome) ?? { nome: p.maquininha.nome, qtd: 0, bruto: 0, taxas: 0 };
      linha.qtd += 1;
      linha.bruto += valorPago(p);
      linha.taxas += taxaDe(p);
      mapa.set(p.maquininha.nome, linha);
    }
    return [...mapa.values()].sort((a, b) => b.taxas - a.taxas);
  }, [filtrados]);

  const porMetodo = filtrados
    .filter((p) => isReceber(p) && isPago(p))
    .reduce<Record<string, number>>((acc, p) => {
      const metodo = p.metodo || "sem método";
      acc[metodo] = (acc[metodo] ?? 0) + valorPago(p);
      return acc;
    }, {});

  const semanasChart = React.useMemo(() => {
    const semanas = semanasDoPeriodo(dataInicio, dataFim);
    const porSemana = new Map(semanas.map((d) => [chaveSemana(d), { rotulo: rotuloSemana(d), entradas: 0, saidas: 0 }]));
    for (const p of filtrados) {
      if (!isPago(p) || !p.data_pagamento) continue;
      const alvo = porSemana.get(chaveSemana(new Date(p.data_pagamento)));
      if (!alvo) continue;
      if (isReceber(p)) alvo.entradas += valorPago(p);
      else alvo.saidas += valorPago(p);
    }
    return [...porSemana.values()];
  }, [filtrados, dataInicio, dataFim]);

  const METODOS_ORDEM = METODO_OPTIONS.map((m) => m.label);
  const itensMetodo = Object.entries(porMetodo)
    .map(([metodo, total]) => ({ rotulo: METODO_LABEL[metodo] ?? metodo.replace("_", " ").replace(/^./, (c) => c.toUpperCase()), valor: total }))
    .sort((a, b) => b.valor - a.valor);

  const handleExportarCSV = () => {
    if (!filtrados.length) {
      warning("Nenhum dado para exportar.");
      return;
    }
    exportCsv(
      `relatorio_fluxo_de_caixa_${dataInicio}_${dataFim}.csv`,
      ["Tipo", "Situação", "Cliente/Fornecedor", "Descrição", "Valor", "Valor pago", "Vencimento", "Pagamento", "Método", "Maquininha", "Taxa de cartão", "Valor líquido"],
      filtrados.map((p) => [
        isReceber(p) ? "Receber" : "Pagar",
        p.status ?? "",
        p.cliente?.nome ?? p.fornecedor?.nome ?? "",
        p.descricao ?? p.categoria ?? "",
        Number(p.valor ?? 0).toFixed(2).replace(".", ","),
        Number(p.valor_pago ?? 0).toFixed(2).replace(".", ","),
        dateBr(p.data_vencimento),
        dateBr(p.data_pagamento),
        p.metodo ? rotuloMetodo(p.metodo, p.cartao_parcelas) : "",
        p.maquininha?.nome ?? "",
        taxaDe(p).toFixed(2).replace(".", ","),
        (Number(p.valor_pago ?? 0) - taxaDe(p)).toFixed(2).replace(".", ","),
      ])
    );
  };

  if (loading) return <EsqueletoPagina />;

  return (
    <ReportPage>
      <ReportHeader
        title="Fluxo de caixa"
        subtitle="Entradas e saídas realizadas no período, e o que ainda vai entrar e sair."
        onExport={handleExportarCSV}
      />

      <BarraFiltros subtitulo="Refine o relatório" valores={filtros} onChange={setFiltros} padrao={PADRAO} campos={campos} />

      <StatGroup espalhar>
        <MetricCard label="Recebido" value={brl(recebido)} helper={taxas > 0 ? `${brl(taxas)} de taxas de cartão` : undefined} />
        <MetricCard label="Pago" value={brl(pago)} />
        <MetricCard label="Saldo realizado" value={brl(saldoRealizado)} />
        <MetricCard label="A receber" value={brl(aReceber)} />
        <MetricCard label="A pagar" value={brl(aPagar)} />
        <MetricCard label="Saldo projetado" value={brl(saldoProjetado)} />
      </StatGroup>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: { xs: 3, lg: 6 }, mb: 4 }}>
        <Box>
          <TituloSecao>Entradas e saídas por semana</TituloSecao>
          <GraficoEntradasSaidas semanas={semanasChart} semDados="Nenhum recebimento ou pagamento realizado no período." />
        </Box>
        <Box>
          <TituloSecao>Recebido por forma de pagamento</TituloSecao>
          <GraficoPizza itens={itensMetodo} ordemCores={METODOS_ORDEM} semDados="Nenhum recebimento pago no período." />
        </Box>
      </Box>

      {porMaquininha.length > 0 && (
        <>
          <TituloSecao>Taxas por maquininha</TituloSecao>
          <Box sx={{ overflowX: "auto", mb: 4 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Maquininha</TableCell>
                  <TableCell align="center">Recebimentos</TableCell>
                  <TableCell align="right">Bruto</TableCell>
                  <TableCell align="right">Taxas</TableCell>
                  <TableCell align="right">Líquido</TableCell>
                  <TableCell align="right">Taxa média</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {porMaquininha.map((m) => (
                  <TableRow key={m.nome} hover>
                    <TableCell>{m.nome}</TableCell>
                    <TableCell align="center">{m.qtd}</TableCell>
                    <TableCell align="right">{brl(m.bruto)}</TableCell>
                    <TableCell align="right">{brl(m.taxas)}</TableCell>
                    <TableCell align="right">{brl(m.bruto - m.taxas)}</TableCell>
                    <TableCell align="right">{m.bruto > 0 ? `${((m.taxas / m.bruto) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </>
      )}

      <TituloSecao>Movimentações</TituloSecao>
      <Box sx={{ overflowX: "auto" }}>
        {filtrados.length ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Tipo</TableCell>
                <TableCell>Cliente/Fornecedor</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell align="center">Vencimento</TableCell>
                <TableCell align="center">Valor</TableCell>
                <TableCell align="center">Pagamento</TableCell>
                <TableCell align="center">Situação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtrados.map((p) => {
                const vencido = isReceber(p) && vencida(p);
                const status = vencido ? "Vencido" : p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : "-";
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>{isReceber(p) ? "Receber" : "Pagar"}</TableCell>
                    <TableCell>{p.cliente?.nome ?? p.fornecedor?.nome ?? "-"}</TableCell>
                    <TableCell>{p.descricao ?? p.categoria ?? "-"}</TableCell>
                    <TableCell align="center">{dateBr(p.data_vencimento)}</TableCell>
                    <TableCell align="center">{brl(Number(p.valor ?? 0))}</TableCell>
                    <TableCell align="center">{dateBr(p.data_pagamento)}</TableCell>
                    <TableCell align="center">{status}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : <EmptyReport message="Nenhum movimento financeiro encontrado no período." />}
      </Box>
    </ReportPage>
  );
}
