import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import api from "../api/api";
import type { AccessAction, AccessModule, PermissionsMap } from "../permissions/accessProfiles";
import { hasPermission } from "../permissions/accessProfiles";

type User = {
  id: number;
  email: string;
  nome: string;
  tipo: string;
  oficina_id: number;
  oficinaId: number;
  oficina_nome?: string | null;
  oficina_logo_url?: string | null;
  perfilAcessoId?: number | null;
  perfilAcessoNome?: string | null;
  permissoes?: PermissionsMap;
  foto_url?: string | null;
};

type OfficeOption = {
  id: number;
  nome: string;
  perfil: string;
  perfilAcessoId?: number | null;
  perfilAcessoNome?: string | null;
  logo_url?: string | null;
};

type SignInResult =
  | { requiresOfficeSelection: false }
  | { requiresOfficeSelection: true; selectionToken: string; oficinas: OfficeOption[] };

type AuthContextType = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string, remember: boolean, emailToken: string) => Promise<SignInResult>;
  selectOffice: (selectionToken: string, oficinaId: number, remember: boolean) => Promise<void>;
  updateCurrentUser: (patch: Partial<User>) => void;
  can: (module: AccessModule, action?: AccessAction) => boolean;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType>({} as any);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("driveon:token") ?? sessionStorage.getItem("driveon:token")
  );

  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("driveon:user") ?? sessionStorage.getItem("driveon:user");
    return raw ? JSON.parse(raw) : null;
  });

  // ✅ Normaliza o usuário retornado pelo backend
  const normalizeUser = (u: any): User => {
    const oficinaId = Number(u.oficina_id ?? u.oficinaId ?? 0);
    return {
      id: u.id,
      email: u.email,
      nome: u.nome,
      tipo: u.tipo,
      oficina_id: oficinaId,
      oficinaId,
      oficina_nome: u.oficina_nome ?? null,
      oficina_logo_url: u.oficina_logo_url ?? u.logo_url ?? null,
      perfilAcessoId: u.perfilAcessoId ?? null,
      perfilAcessoNome: u.perfilAcessoNome ?? null,
      permissoes: u.permissoes ?? {},
      foto_url: u.foto_url ?? null,
    };
  };

  // ✅ Armazena token e usuário de forma persistente
  const persist = (t: string, u: User, remember: boolean) => {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem("driveon:token", t);
    storage.setItem("driveon:user", JSON.stringify(u));
    setToken(t);
    setUser(u);
    api.defaults.headers.common["Authorization"] = `Bearer ${t}`;
  };

  // ✅ Login e persistência
  const signIn = useCallback(async (email: string, password: string, remember: boolean, emailToken: string): Promise<SignInResult> => {
    const { data } = await api.post("/auth/login", { email, senha: password, emailToken });
    if (data.requiresOfficeSelection) {
      return {
        requiresOfficeSelection: true as const,
        selectionToken: data.selectionToken,
        oficinas: data.oficinas ?? [],
      };
    }
    persist(data.token, normalizeUser(data.usuario), remember);
    return { requiresOfficeSelection: false as const };
  }, []);

  const selectOffice = useCallback(async (selectionToken: string, oficinaId: number, remember: boolean) => {
    const { data } = await api.post("/auth/select-oficina", {
      selectionToken,
      oficina_id: oficinaId,
    });
    persist(data.token, normalizeUser(data.usuario), remember);
  }, []);

  // ✅ Logout
  const updateCurrentUser = useCallback((patch: Partial<User>) => {
    setUser((current) => {
      if (!current) return current;

      const next = { ...current, ...patch };
      const storage = localStorage.getItem("driveon:user") ? localStorage : sessionStorage;
      storage.setItem("driveon:user", JSON.stringify(next));
      return next;
    });
  }, []);

  const signOut = () => {
    localStorage.removeItem("driveon:token");
    localStorage.removeItem("driveon:user");
    sessionStorage.removeItem("driveon:token");
    sessionStorage.removeItem("driveon:user");
    setToken(null);
    setUser(null);
    delete api.defaults.headers.common["Authorization"];
  };

  const can = useCallback(
    (module: AccessModule, action: AccessAction = "read") => hasPermission(user?.permissoes, module, action),
    [user?.permissoes]
  );

  // ✅ Garante que o header Authorization sempre exista
  if (token && !api.defaults.headers.common["Authorization"]) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!token,
      signIn,
      selectOffice,
      updateCurrentUser,
      can,
      signOut,
    }),
    [user, token, signIn, selectOffice, updateCurrentUser, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
