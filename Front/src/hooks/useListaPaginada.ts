import * as React from "react";
import api from "../api/api";

type Filtros = Record<string, string | number | boolean | null | undefined>;

type Opcoes = {
  filtros?: Filtros;
  linhasPorPaginaInicial?: number;
  /** Atraso aplicado quando os filtros mudam (busca digitada), para não consultar a cada tecla. */
  debounceMs?: number;
  /** Chamado quando a requisição falha. */
  onError?: (err: unknown) => void;
};

/** Valores vazios e "todos" não vão para a query. */
function limparFiltros(filtros: Filtros) {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(filtros)) {
    if (v === undefined || v === null || v === "" || v === "todos") continue;
    out[k] = v;
  }
  return out;
}

/**
 * Lista paginada no servidor: manda page/limit/filtros e lê o total em X-Total-Count.
 * A página volta para a primeira sempre que um filtro muda.
 */
export function useListaPaginada<T>(endpoint: string, { filtros = {}, linhasPorPaginaInicial = 10, debounceMs = 300, onError }: Opcoes = {}) {
  const [rows, setRows] = React.useState<T[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [carregou, setCarregou] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPageState] = React.useState(linhasPorPaginaInicial);
  const [versao, setVersao] = React.useState(0);

  const chaveFiltros = JSON.stringify(limparFiltros(filtros));
  const [filtrosAtivos, setFiltrosAtivos] = React.useState(chaveFiltros);
  const primeiroRender = React.useRef(true);
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;

  // Aplica os filtros com debounce e volta para a primeira página.
  React.useEffect(() => {
    if (primeiroRender.current) {
      primeiroRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      setFiltrosAtivos(chaveFiltros);
      setPage(0);
    }, debounceMs);
    return () => clearTimeout(t);
  }, [chaveFiltros, debounceMs]);

  React.useEffect(() => {
    let cancelado = false;
    setLoading(true);
    api
      .get<T[]>(endpoint, { params: { ...JSON.parse(filtrosAtivos), page: page + 1, limit: rowsPerPage } })
      .then((res) => {
        if (cancelado) return;
        setRows(res.data);
        setTotal(Number(res.headers["x-total-count"] ?? res.data.length));
      })
      .catch((err) => {
        if (!cancelado) onErrorRef.current?.(err);
      })
      .finally(() => {
        if (cancelado) return;
        setLoading(false);
        setCarregou(true);
      });
    return () => {
      cancelado = true;
    };
  }, [endpoint, filtrosAtivos, page, rowsPerPage, versao]);

  // Se a última página esvaziou (ex.: exclusão do único item), volta uma página.
  React.useEffect(() => {
    if (!loading && rows.length === 0 && page > 0) setPage((p) => p - 1);
  }, [loading, rows.length, page]);

  const setRowsPerPage = React.useCallback((n: number) => {
    setRowsPerPageState(n);
    setPage(0);
  }, []);
  const recarregar = React.useCallback(() => setVersao((v) => v + 1), []);

  /** carregandoInicial é verdadeiro só até a primeira resposta; depois, buscas e trocas de página não desmontam a tela. */
  const carregandoInicial = !carregou;
  return { rows, total, loading, carregandoInicial, page, setPage, rowsPerPage, setRowsPerPage, recarregar };
}
