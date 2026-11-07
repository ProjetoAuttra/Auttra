import * as React from "react";
import {
  Box, Chip, Fade, Table, TableBody, TableCell, TableHead,
  TablePagination, TableRow, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import api from "../../../../api/api";
import { useToast } from "../../../../context/ToastContext";
import { useListaPaginada } from "../../../../hooks/useListaPaginada";
import ModuleHeader from "../../../../components/layout/ModuleHeader";
import StatCard, { StatGroup } from "../../../../components/common/StatCard";
import EmptyState from "../../../../components/common/EmptyState";
import ListTableContainer from "../../../../components/common/ListTableContainer";
import TextoLimitado from "../../../../components/common/TextoLimitado";
import { METODO_FILTRO_OPTIONS, brl, formatarData, rotuloMetodo } from "../../api/api";
import BarraFiltros, { type CampoFiltro } from "../../../../components/common/BarraFiltros";
import { listarMaquininhas, type Maquininha } from "../../../configuracoes/api/maquininhas";
import LinhasEsqueleto from "../../../../components/common/LinhasEsqueleto";

/** Título pago, como vem de GET /pagamentos (visão por recebimento). */
type Movimento = {
  id: number;
  tipo: "receber" | "pagar";
  descricao?: string | null;
  categoria?: string | null;
  metodo?: string | null;
  cartao_parcelas?: number | null;
  valor_pago: number | string;
  data_pagamento: string;
  cliente?: { nome: string } | null;
  fornecedor?: { nome: string } | null;
};

/** Linha de GET /pagamentos/extrato/efetivacao: um título pago ou uma parcela do cartão que cai na conta. */
type LinhaEfetivacao = {
  chave: string;
  tipo: "receber" | "pagar";
  data: string;
  valor: number;
  valor_bruto: number;
  valor_taxa: number;
  descricao?: string | null;
  categoria?: string | null;
  metodo?: string | null;
  cartao_parcelas?: number | null;
  parcela?: number | null;
  total_parcelas?: number | null;
  maquininha?: string | null;
  cliente?: string | null;
  fornecedor?: string | null;
};

/** O que a tabela mostra, igual nas duas visões. */
type Linha = { chave: string; entrada: boolean; data: string; descricao: string; pessoa: string; forma: string; detalhe?: string; valor: number };

const deMovimento = (m: Movimento): Linha => ({
  chave: `p${m.id}`,
  entrada: m.tipo === "receber",
  data: m.data_pagamento,
  descricao: m.descricao || m.categoria || "—",
  pessoa: m.cliente?.nome ?? m.fornecedor?.nome ?? "—",
  forma: m.metodo ? rotuloMetodo(m.metodo, m.cartao_parcelas) : "—",
  valor: Number(m.valor_pago),
});

const deEfetivacao = (l: LinhaEfetivacao): Linha => ({
  chave: l.chave,
  entrada: l.tipo === "receber",
  data: l.data,
  descricao: l.descricao || l.categoria || "—",
  pessoa: l.cliente ?? l.fornecedor ?? "—",
  forma:
    (l.metodo ? rotuloMetodo(l.metodo, l.cartao_parcelas) : "—") +
    (l.parcela && l.total_parcelas && l.total_parcelas > 1 ? ` · parcela ${l.parcela}/${l.total_parcelas}` : ""),
  detalhe: l.valor_taxa > 0 ? `${l.maquininha ? `${l.maquininha} · ` : ""}${brl(l.valor_bruto)} − ${brl(l.valor_taxa)} de taxa` : undefined,
  valor: Number(l.valor),
});

type Resumo = { entradas: number; saidas: number; saldo: number; qtd_entradas: number; qtd_saidas: number; taxas_cartao?: number };
type ACair = { total: number; qtd: number; proxima: string | null; ultima: string | null };
/** "" = entradas e saídas. */
type Tipo = "" | "receber" | "pagar";
/** Efetivação: quando e quanto cai na conta (cartão líquido, por parcela). Recebimento: no dia da venda, bruto. */
type Visao = "efetivacao" | "recebimento";
/** Visão e período ficam na tela; movimento, formas e maquininhas, no painel de filtros. */
type Filtros = { visao: Visao; tipo: Tipo; de: string; ate: string; metodos: string[]; maquininhas: string[] };

/** Filtros do painel lateral que estão ligados (para o número no botão). */
const contarAvancados = (f: Filtros) => (f.tipo ? 1 : 0) + (f.metodos.length ? 1 : 0) + (f.maquininhas.length ? 1 : 0);

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Mês atual, entradas e saídas, pela efetivação. */
function filtrosPadrao(hoje = new Date()): Filtros {
  return {
    visao: "efetivacao",
    tipo: "",
    de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
    ate: iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
    metodos: [],
    maquininhas: [],
  };
}

/**
 * Extrato: o dinheiro que entrou e saiu no período. Na efetivação (padrão), o cartão entra líquido da taxa
 * e parcela por parcela, no dia em que cai na conta; o resto entra no dia do pagamento. Por recebimento,
 * tudo entra bruto no dia da venda. Os totais vêm do servidor e cobrem o período inteiro, não só a página.
 */
export default function ExtratoFinanceiro() {
  const { error } = useToast();
  const [filtros, setFiltros] = React.useState<Filtros>(() => filtrosPadrao());
  const padrao = filtrosPadrao();
  const filtrado = contarAvancados(filtros) > 0 || filtros.de !== padrao.de || filtros.ate !== padrao.ate;
  const limparTudo = () => setFiltros((f) => ({ ...filtrosPadrao(), visao: f.visao }));

  // Opções de maquininha do painel (inclui as inativas para quem pode ver; recebimentos antigos podem ser delas).
  const [maquininhas, setMaquininhas] = React.useState<Maquininha[]>([]);
  React.useEffect(() => {
    let ativo = true;
    listarMaquininhas(true)
      .then((l) => { if (ativo) setMaquininhas(Array.isArray(l) ? l : []); })
      .catch(() => {});
    return () => { ativo = false; };
  }, []);
  const periodoInvalido = !!filtros.de && !!filtros.ate && filtros.de > filtros.ate;
  const efetivacao = filtros.visao === "efetivacao";

  const periodo = React.useMemo(
    () =>
      efetivacao
        ? { de: filtros.de, ate: filtros.ate }
        : { pagamento_de: filtros.de, pagamento_ate: filtros.ate, tz_offset: String(new Date().getTimezoneOffset()) },
    [efetivacao, filtros.de, filtros.ate]
  );

  const campos: CampoFiltro<Filtros>[] = [
    {
      id: "tipo",
      label: "Movimento",
      vazio: "Entradas e saídas",
      opcoes: [{ value: "receber", label: "Só entradas" }, { value: "pagar", label: "Só saídas" }],
    },
    { id: "metodos", label: "Forma de pagamento", multi: true, vazio: "Todas", opcoes: METODO_FILTRO_OPTIONS.map((m) => ({ value: m.value, label: m.label })) },
    // Inativas também: recebimentos antigos podem ser delas. Sem maquininha cadastrada, o campo nem aparece.
    ...(maquininhas.length
      ? [{
          id: "maquininhas" as const,
          label: "Maquininha",
          multi: true,
          vazio: "Todas",
          opcoes: maquininhas.map((m) => ({ value: String(m.id), label: m.nome, detalhe: m.ativo ? undefined : "Inativa" })),
        }]
      : []),
  ];

  const { rows, total, loading, carregandoInicial, page, setPage, rowsPerPage, setRowsPerPage } =
    useListaPaginada<Movimento | LinhaEfetivacao>(efetivacao ? "/pagamentos/extrato/efetivacao" : "/pagamentos", {
      filtros: {
        ...(efetivacao ? {} : { status: "pago", ordem: "pagamento" }),
        tipo: filtros.tipo,
        metodo: filtros.metodos.join(","),
        maquininha: filtros.maquininhas.join(","),
        ...(periodoInvalido ? {} : periodo),
      },
      onError: (err) => {
        console.error("Erro ao carregar extrato:", err);
        error("Não foi possível carregar o extrato.");
      },
    });
  // Na troca de visão, a lista antiga ainda aparece até a nova chegar: cada linha é lida pelo próprio formato.
  const linhas = rows.map((r) => ("chave" in r ? deEfetivacao(r) : deMovimento(r)));

  const [resumo, setResumo] = React.useState<Resumo | null>(null);
  const [resumoFalhou, setResumoFalhou] = React.useState(false);
  React.useEffect(() => {
    if (periodoInvalido) return;
    let ativo = true;
    api
      .get<Resumo>(efetivacao ? "/pagamentos/extrato/efetivacao/resumo" : "/pagamentos/extrato/resumo", { params: periodo })
      .then(({ data }) => { if (ativo) { setResumo(data); setResumoFalhou(false); } })
      .catch((err) => {
        console.error("Erro ao carregar totais do extrato:", err);
        if (ativo) setResumoFalhou(true);
      });
    return () => { ativo = false; };
  }, [efetivacao, periodo, periodoInvalido]);

  // O que ainda vai cair das maquininhas não depende do período.
  const [aCair, setACair] = React.useState<ACair | null>(null);
  React.useEffect(() => {
    let ativo = true;
    api
      .get<ACair>("/pagamentos/extrato/a-cair")
      .then(({ data }) => { if (ativo) setACair(data); })
      .catch(() => { if (ativo) setACair(null); });
    return () => { ativo = false; };
  }, []);

  /** Mostra as parcelas futuras: efetivação, de amanhã até a última data prevista. */
  const verACair = () => {
    if (!aCair?.ultima) return;
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    setFiltros((f) => ({ ...f, visao: "efetivacao", tipo: "receber", metodos: [], maquininhas: [], de: iso(amanha), ate: aCair.ultima! }));
  };

  const valorCard = (v: number | undefined) => (resumoFalhou || v === undefined ? "—" : brl(v));
  const contagem = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  const ajudaEntradas = () => {
    if (!resumo || resumoFalhou) return undefined;
    const taxas = resumo.taxas_cartao ? brl(resumo.taxas_cartao) : null;
    if (efetivacao) return contagem(resumo.qtd_entradas, "entrada", "entradas") + (taxas ? ` · já sem ${taxas} de taxas` : "");
    return contagem(resumo.qtd_entradas, "recebimento", "recebimentos") + (taxas ? ` · ${taxas} de taxas de cartão` : "");
  };

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>
      <ModuleHeader
        title="Extrato"
        subtitle={
          efetivacao
            ? "O dinheiro que entrou e saiu da conta no período. O cartão entra sem a taxa, no dia em que cai."
            : "O que foi recebido e pago no período, pelo valor cheio e na data da venda."
        }
        icon={<AccountBalanceWalletRoundedIcon />}
      />

      <StatGroup espalhar>
        <StatCard label="Entradas" value={valorCard(resumo?.entradas)} helper={ajudaEntradas()} icon={<ArrowDownwardRoundedIcon />} tone="success" />
        <StatCard
          label="Saídas"
          value={valorCard(resumo?.saidas)}
          helper={resumo && !resumoFalhou ? contagem(resumo.qtd_saidas, "pagamento", "pagamentos") : undefined}
          icon={<ArrowUpwardRoundedIcon />}
          tone="error"
        />
        <StatCard
          label="Saldo do período"
          value={valorCard(resumo?.saldo)}
          icon={<SavingsRoundedIcon />}
          tone={resumo && resumo.saldo < 0 ? "warning" : "primary"}
        />
        {/* Só na efetivação: é lá que as parcelas futuras aparecem na lista. */}
        {efetivacao && aCair && aCair.qtd > 0 && (
          <StatCard
            label="A cair das maquininhas"
            value={brl(aCair.total)}
            helper={`${contagem(aCair.qtd, "parcela", "parcelas")} · próxima em ${formatarData(aCair.proxima)}`}
            icon={<EventAvailableRoundedIcon />}
            tone="info"
            onClick={verACair}
          />
        )}
      </StatGroup>

      <BarraFiltros
        valores={filtros}
        onChange={setFiltros}
        padrao={padrao}
        campos={campos}
        manter={["visao"]}
        subtitulo="Refine o extrato"
        inicio={
          <ToggleButtonGroup
            exclusive
            size="small"
            value={filtros.visao}
            onChange={(_, v: Visao | null) => v && setFiltros((f) => ({ ...f, visao: v }))}
            aria-label="Ver extrato por"
            sx={{ "& .MuiToggleButton-root": { px: 1.75, textTransform: "none", fontWeight: 600 } }}
          >
            <ToggleButton value="efetivacao">Efetivação</ToggleButton>
            <ToggleButton value="recebimento">Recebimento</ToggleButton>
          </ToggleButtonGroup>
        }
      />

      <Fade in timeout={400}>
        <ListTableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>{efetivacao ? "Cai em" : "Data"}</TableCell>
                <TableCell>Movimento</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell>Cliente / fornecedor</TableCell>
                <TableCell>Forma</TableCell>
                <TableCell align="right">Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody sx={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
              {carregandoInicial ? <LinhasEsqueleto colunas={6} /> : linhas.length > 0 ? linhas.map((m) => (
                <TableRow key={m.chave} hover sx={{ height: 56 }}>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatarData(m.data)}</TableCell>
                  <TableCell>
                    <Chip
                      label={m.entrada ? "Entrada" : "Saída"}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        fontSize: 12,
                        bgcolor: (t) => alpha(m.entrada ? t.palette.success.main : t.palette.error.main, 0.1),
                        color: m.entrada ? "success.main" : "error.main",
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextoLimitado texto={m.descricao} linhas={2} variant="body2" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{m.pessoa}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{m.forma}</Typography>
                    {m.detalhe && <Typography variant="caption" color="text.secondary">{m.detalhe}</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 700, color: m.entrada ? "success.main" : "error.main" }}>
                    {m.entrada ? "+ " : "− "}{brl(m.valor)}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} sx={{ border: 0 }}>
                    <EmptyState
                      icon={<AccountBalanceWalletRoundedIcon />}
                      title="Nenhuma movimentação no período"
                      description={
                        efetivacao
                          ? "Recebimentos e pagamentos aparecem aqui no dia em que o dinheiro cai ou sai da conta."
                          : "Recebimentos e pagamentos registrados aparecem aqui pela data em que foram pagos."
                      }
                      isFiltered={filtrado}
                      onClearFilter={limparTudo}
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
