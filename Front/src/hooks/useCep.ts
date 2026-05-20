import * as React from "react";

export type DadosCep = {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export function useCep() {
  const [loading, setLoading] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  const buscar = React.useCallback(async (cep: string): Promise<DadosCep | null> => {
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) return null;

    setLoading(true);
    setErro(null);

    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.erro) {
        setErro("CEP não encontrado");
        return null;
      }
      return {
        logradouro: data.logradouro ?? "",
        bairro: data.bairro ?? "",
        cidade: data.localidade ?? "",
        uf: data.uf ?? "",
      };
    } catch {
      setErro("Não foi possível consultar o CEP");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { buscar, loading, erro, setErro };
}
