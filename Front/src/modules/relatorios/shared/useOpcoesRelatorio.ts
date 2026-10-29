import * as React from "react";
import api from "../../../api/api";
import type { Opcao } from "./FiltrosRelatorio";

const comoOpcoes = (lista: unknown): Opcao[] =>
  (Array.isArray(lista) ? lista : [])
    .filter((x: any) => x?.id != null && x?.nome)
    .map((x: any) => ({ value: String(x.id), label: String(x.nome) }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

/** Mecânicos e clientes da oficina, como opções de filtro. Falhas deixam a lista vazia (o filtro some das opções, o relatório segue). */
export function useOpcoesRelatorio({ mecanicos = false, clientes = false } = {}) {
  const [opcoes, setOpcoes] = React.useState<{ mecanicos: Opcao[]; clientes: Opcao[] }>({ mecanicos: [], clientes: [] });

  React.useEffect(() => {
    let vivo = true;
    const buscar = (url: string, ativo: boolean) => (ativo ? api.get(url).then((r) => comoOpcoes(r.data)).catch(() => []) : Promise.resolve([]));
    Promise.all([buscar("/funcionarios", mecanicos), buscar("/clientes", clientes)]).then(([m, c]) => {
      if (vivo) setOpcoes({ mecanicos: m, clientes: c });
    });
    return () => {
      vivo = false;
    };
  }, [mecanicos, clientes]);

  return opcoes;
}
