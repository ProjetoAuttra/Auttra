import * as React from "react";
import api from "../../../api/api";
import { useToast } from "../../../context/ToastContext";

/** Busca um relatório agregado no servidor e refaz a consulta quando os parâmetros mudam. */
export function useRelatorio<T>(endpoint: string, params: Record<string, string> = {}) {
  const { error } = useToast();
  const [dados, setDados] = React.useState<T | null>(null);
  const [carregando, setCarregando] = React.useState(true);
  const chave = JSON.stringify(params);

  React.useEffect(() => {
    let vivo = true;
    setCarregando(true);
    api
      .get<T>(endpoint, { params: JSON.parse(chave) })
      .then((res) => {
        if (vivo) setDados(res.data);
      })
      .catch((err) => {
        console.error(`Erro ao carregar ${endpoint}:`, err);
        if (vivo) error(err?.response?.data?.message ?? "Não foi possível carregar o relatório.");
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [endpoint, chave, error]);

  return { dados, carregando };
}
