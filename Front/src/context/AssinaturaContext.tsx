import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import api, { EVENTO_ASSINATURA_NECESSARIA } from "../api/api";
import { useAuth } from "./AuthContext";
import type { Assinatura } from "../modules/assinatura/assinatura";

type AssinaturaContextType = {
  /** null enquanto carrega ou se a consulta falhar: nesse caso nada de faixa nem de aviso. */
  assinatura: Assinatura | null;
  recarregar: () => Promise<void>;
  /** Modal de compra do Premium (aberto pela faixa do topo e pelo item do menu). */
  /** Teste vencido ou assinatura suspensa. */
  somenteLeitura: boolean;
  planosAbertos: boolean;
  abrirPlanos: () => void;
  fecharPlanos: () => void;
};

const AssinaturaContext = createContext<AssinaturaContextType>({
  assinatura: null,
  recarregar: async () => {},
  somenteLeitura: false,
  planosAbertos: false,
  abrirPlanos: () => {},
  fecharPlanos: () => {},
});

/** Situação da assinatura da oficina logada (GET /assinatura), lida uma vez por sessão e oficina. */
export function AssinaturaProvider({ children }: { children: ReactNode }) {
  const { user, definirSomenteLeitura } = useAuth();
  const oficinaId = user?.oficinaId;
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [planosAbertos, setPlanosAbertos] = useState(false);
  const abrirPlanos = useCallback(() => setPlanosAbertos(true), []);
  const fecharPlanos = useCallback(() => setPlanosAbertos(false), []);

  const recarregar = useCallback(async () => {
    try {
      const { data } = await api.get<Assinatura>("/assinatura");
      setAssinatura(data);
    } catch {
      setAssinatura(null);
    }
  }, []);

  useEffect(() => {
    setAssinatura(null);
    if (oficinaId) void recarregar();
  }, [oficinaId, recarregar]);

  // O can() do AuthContext passa a negar escrita na conta só leitura; ao sair do sistema, volta ao normal.
  const somenteLeitura = !!assinatura?.somenteLeitura;
  useEffect(() => {
    definirSomenteLeitura(somenteLeitura);
    return () => definirSomenteLeitura(false);
  }, [somenteLeitura, definirSomenteLeitura]);

  // Escrita recusada pelo back (o teste pode ter vencido com a tela aberta): atualiza a situação e oferece o Premium.
  useEffect(() => {
    const bloqueado = () => {
      void recarregar();
      setPlanosAbertos(true);
    };
    window.addEventListener(EVENTO_ASSINATURA_NECESSARIA, bloqueado);
    return () => window.removeEventListener(EVENTO_ASSINATURA_NECESSARIA, bloqueado);
  }, [recarregar]);

  const value = useMemo(
    () => ({ assinatura, recarregar, somenteLeitura, planosAbertos, abrirPlanos, fecharPlanos }),
    [assinatura, recarregar, somenteLeitura, planosAbertos, abrirPlanos, fecharPlanos]
  );
  return <AssinaturaContext.Provider value={value}>{children}</AssinaturaContext.Provider>;
}

export const useAssinatura = () => useContext(AssinaturaContext);
