import * as React from "react";
import { MenuItem, TextField, Typography } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import BarraFiltros, { type CampoFiltro } from "../../../components/common/BarraFiltros";
import { METODO_FILTRO_OPTIONS as METODO_OPTIONS, hojeInput } from "../api/api";

export type StatusConta = "pendente" | "vencido" | "pago" | "cancelado";

export type DataPor = "vencimento" | "pagamento";

export type FiltrosConta = {
  /** Vazio = todas as situações. */
  situacao: StatusConta[];
  /** A que data o período se refere: vencimento ou recebimento/pagamento. */
  dataPor: DataPor;
  /** Período (YYYY-MM-DD); o padrão é o mês atual. */
  de: string;
  ate: string;
  parceiroId: string;
  /** Vazio = todas as formas de pagamento. */
  metodos: string[];
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Vencimento do dia 1 ao último dia do mês atual, sem filtro de situação nem de detalhes. */
export function filtrosPadrao(hoje = new Date()): FiltrosConta {
  return {
    situacao: [],
    dataPor: "vencimento",
    de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
    ate: iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
    parceiroId: "",
    metodos: [],
  };
}

/** Filtros do painel lateral (os que não ficam visíveis na tela). */
export const contarFiltrosAvancados = (f: FiltrosConta) => (f.situacao.length ? 1 : 0) + (f.parceiroId ? 1 : 0) + (f.metodos.length ? 1 : 0);

/** Algum filtro difere do padrão (vencimento no mês atual, sem situação nem detalhes). */
export function temFiltroAtivo(f: FiltrosConta, padrao = filtrosPadrao()) {
  return contarFiltrosAvancados(f) > 0 || f.dataPor !== padrao.dataPor || f.de !== padrao.de || f.ate !== padrao.ate;
}

/**
 * "Vencidos" com o período padrão (vencimento no mês atual) mostraria só os vencidos deste mês,
 * enquanto o card "Vencidos" soma todos. Nesse caso o período de vencimento não vai para a API.
 * Se o usuário mudar o período, ele volta a valer.
 */
export function vencidosSemPeriodo(f: FiltrosConta, padrao = filtrosPadrao()) {
  return f.situacao.includes("vencido") && f.dataPor === "vencimento" && f.de === padrao.de && f.ate === padrao.ate;
}

/** Parâmetros de GET /pagamentos para os filtros (campo do parceiro: cliente_id ou fornecedor_id). */
export function paramsFiltros(f: FiltrosConta, campoParceiro: "cliente_id" | "fornecedor_id", padrao = filtrosPadrao()) {
  const porPagamento = f.dataPor === "pagamento";
  const semPeriodo = vencidosSemPeriodo(f, padrao);
  return {
    status: f.situacao.join(","),
    hoje: f.situacao.includes("vencido") ? hojeInput() : "",
    [porPagamento ? "pagamento_de" : "vencimento_de"]: semPeriodo ? "" : f.de,
    [porPagamento ? "pagamento_ate" : "vencimento_ate"]: semPeriodo ? "" : f.ate,
    tz_offset: porPagamento ? String(new Date().getTimezoneOffset()) : "",
    metodo: f.metodos.join(","),
    [campoParceiro]: f.parceiroId,
  };
}

const SITUACOES: StatusConta[] = ["pendente", "vencido", "pago", "cancelado"];

/** Situações vindas da URL (?situacao=vencido ou ?situacao=vencido,pendente), ignorando valores desconhecidos. */
export const situacaoDaUrl = (valor: string | null): StatusConta[] =>
  (valor ?? "").split(",").filter((s): s is StatusConta => SITUACOES.includes(s as StatusConta));

/**
 * Filtros das contas com a situação na URL: links (ex.: alerta do painel) abrem a lista já filtrada
 * e mudar a situação na tela atualiza o endereço, sem empilhar histórico.
 */
export function useFiltrosContas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtros, setFiltrosState] = React.useState<FiltrosConta>(() => ({
    ...filtrosPadrao(),
    situacao: situacaoDaUrl(searchParams.get("situacao")),
  }));
  const setFiltros = React.useCallback((f: FiltrosConta) => {
    setFiltrosState(f);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (f.situacao.length) next.set("situacao", f.situacao.join(","));
      else next.delete("situacao");
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  return [filtros, setFiltros] as const;
}

type Parceiro = { id: number; nome: string };

type Props = {
  filtros: FiltrosConta;
  onChange: (f: FiltrosConta) => void;
  /** Contas a receber ou a pagar: define os rótulos Recebidos/Recebimento ou Pagos/Pagamento. */
  tipo: "receber" | "pagar";
  rotuloParceiro: "Cliente" | "Fornecedor";
  parceiros: Parceiro[];
};

/** Filtros das contas na barra padrão: tipo de data e período na tela; situação, cliente/fornecedor e forma de pagamento no painel. */
export default function FiltrosContas({ filtros, onChange, tipo, rotuloParceiro, parceiros }: Props) {
  const padrao = filtrosPadrao();
  const campos: CampoFiltro<FiltrosConta>[] = [
    {
      id: "situacao",
      label: "Situação",
      multi: true,
      vazio: "Todas as situações",
      opcoes: [
        { value: "pendente", label: "Pendentes" },
        { value: "vencido", label: "Vencidos" },
        { value: "pago", label: tipo === "receber" ? "Recebidos" : "Pagos" },
        { value: "cancelado", label: "Cancelados" },
      ],
    },
    { id: "parceiroId", label: rotuloParceiro, busca: true, vazio: "Todos", opcoes: parceiros.map((p) => ({ value: String(p.id), label: p.nome })) },
    { id: "metodos", label: "Forma de pagamento", multi: true, vazio: "Todas", opcoes: METODO_OPTIONS.map((m) => ({ value: m.value, label: m.label })) },
  ];

  return (
    <BarraFiltros
      valores={filtros}
      onChange={onChange}
      padrao={padrao}
      campos={campos}
      subtitulo="Refine a lista de contas"
      inicio={
        <TextField
          select
          size="small"
          label="Data"
          value={filtros.dataPor}
          onChange={(e) => onChange({ ...filtros, dataPor: e.target.value as DataPor })}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="vencimento">Vencimento</MenuItem>
          <MenuItem value="pagamento">{tipo === "receber" ? "Recebimento" : "Pagamento"}</MenuItem>
        </TextField>
      }
    >
      {vencidosSemPeriodo(filtros, padrao) && (
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: { md: "center" } }}>
          Vencidos: todos os períodos
        </Typography>
      )}
    </BarraFiltros>
  );
}
