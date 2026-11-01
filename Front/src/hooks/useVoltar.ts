import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * "Voltar" de uma tela de detalhe: volta ao histórico quando o usuário chegou por navegação
 * dentro do sistema; se abriu o link direto (aba nova, URL colada), vai para a lista.
 */
export function useVoltar(lista: string) {
  const nav = useNavigate();
  const location = useLocation();
  return React.useCallback(() => {
    if (location.key !== "default") nav(-1);
    else nav(lista);
  }, [nav, location.key, lista]);
}
