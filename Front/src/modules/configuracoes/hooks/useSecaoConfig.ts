import * as React from "react";
import { useToast } from "../../../context/ToastContext";

type Opcoes<T> = {
  padrao: T;
  buscar: () => Promise<T>;
  salvar: (valor: T) => Promise<T>;
  /** Ex.: "as configurações de agenda" — vira "Configurações de agenda salvas." e a mensagem de erro. */
  nome: string;
  /** Devolve true quando o formulário tem erro e não pode ser salvo. */
  temErro?: (valor: T) => boolean;
};

/**
 * Estado de uma seção de Configurações: carrega só quando a seção abre, guarda o último valor salvo
 * para saber se há alterações e para "Descartar", e salva com o aviso padrão.
 */
export function useSecaoConfig<T>({ padrao, buscar, salvar, nome, temErro }: Opcoes<T>) {
  const { success, error } = useToast();
  const [valor, setValor] = React.useState<T>(padrao);
  const [salvo, setSalvo] = React.useState<T>(padrao);
  const [carregando, setCarregando] = React.useState(true);
  const [falhou, setFalhou] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [tentouSalvar, setTentouSalvar] = React.useState(false);
  const [tentativa, setTentativa] = React.useState(0);

  // `buscar` é uma função de módulo (estável): o efeito roda ao abrir a seção e a cada "Tentar novamente".
  React.useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setFalhou(false);
    buscar()
      .then((data) => {
        if (!ativo) return;
        setValor(data);
        setSalvo(data);
      })
      .catch(() => {
        if (ativo) setFalhou(true);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [buscar, tentativa]);

  const alterado = React.useMemo(() => JSON.stringify(valor) !== JSON.stringify(salvo), [valor, salvo]);

  const titulo = nome.replace(/^(as|os) /, "");
  const salvarAlteracoes = async () => {
    setTentouSalvar(true);
    if (temErro?.(valor)) return;
    setSalvando(true);
    try {
      const data = await salvar(valor);
      setValor(data);
      setSalvo(data);
      setTentouSalvar(false);
      success(`${titulo.charAt(0).toUpperCase()}${titulo.slice(1)} salvas.`);
    } catch (e) {
      const mensagem = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      error(mensagem ?? `Não foi possível salvar ${nome}.`);
    } finally {
      setSalvando(false);
    }
  };

  const descartar = () => {
    setValor(salvo);
    setTentouSalvar(false);
  };

  return {
    valor,
    setValor,
    carregando,
    falhou,
    tentarNovamente: () => setTentativa((n) => n + 1),
    salvando,
    alterado,
    /** Só mostra os erros dos campos depois da primeira tentativa de salvar. */
    mostrarErros: tentouSalvar,
    salvar: salvarAlteracoes,
    descartar,
  };
}
