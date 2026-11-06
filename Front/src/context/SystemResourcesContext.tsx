import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import {
  defaultSystemResources,
  obterRecursosSistema,
  salvarRecursosSistema,
  type SystemResourceKey,
  type SystemResourcesMap,
} from "../modules/recursos-sistema/api/api";

type SystemResourcesContextType = {
  resources: SystemResourcesMap;
  loading: boolean;
  isEnabled: (resource: SystemResourceKey) => boolean;
  refresh: () => Promise<void>;
  save: (resources: SystemResourcesMap) => Promise<SystemResourcesMap>;
};

const SystemResourcesContext = createContext<SystemResourcesContextType>({} as SystemResourcesContextType);

export function SystemResourcesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [resources, setResources] = useState<SystemResourcesMap>(defaultSystemResources);
  const [loading, setLoading] = useState(false);

  const refresh = React.useCallback(async () => {
    if (!isAuthenticated) {
      setResources(defaultSystemResources);
      return;
    }

    setLoading(true);
    try {
      setResources(await obterRecursosSistema());
    } catch {
      setResources(defaultSystemResources);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = React.useCallback(async (next: SystemResourcesMap) => {
    const saved = await salvarRecursosSistema(next);
    setResources(saved);
    return saved;
  }, []);

  const value = useMemo(
    () => ({
      resources,
      loading,
      isEnabled: (resource: SystemResourceKey) => resources[resource],
      refresh,
      save,
    }),
    [loading, refresh, resources, save]
  );

  return <SystemResourcesContext.Provider value={value}>{children}</SystemResourcesContext.Provider>;
}

export const useSystemResources = () => useContext(SystemResourcesContext);
