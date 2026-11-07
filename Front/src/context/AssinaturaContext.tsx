import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import api from "../api/api";
import { useAuth } from "./AuthContext";
import type { Assinatura } from "../modules/assinatura/assinatura";

type AssinaturaContextType = {
  /** null enquanto carrega ou se a consulta falhar: nesse caso nada de faixa nem de aviso. */
  assinatura: Assinatura | null;
  recarregar: () => Promise<void>;
  /** Modal de compra do Premium (aberto pela faixa do topo e pelo item do menu). */
  planosAbertos: boolean;
  abrirPlanos: () => void;
  fecharPlanos: () => void;
};

const AssinaturaContext = createContext<AssinaturaContextType>({
  assinatura: null,
  recarregar: async () => {},
  planosAbertos: false,
  abrirPlanos: () => {},
  fecharPlanos: () => {},
});

/** Situação da assinatura da oficina logada (GET /assinatura), lida uma vez por sessão e oficina. */
export function AssinaturaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
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

  const value = useMemo(
    () => ({ assinatura, recarregar, planosAbertos, abrirPlanos, fecharPlanos }),
    [assinatura, recarregar, planosAbertos, abrirPlanos, fecharPlanos]
  );
  return <AssinaturaContext.Provider value={value}>{children}</AssinaturaContext.Provider>;
}

export const useAssinatura = () => useContext(AssinaturaContext);
