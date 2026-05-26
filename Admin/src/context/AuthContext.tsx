import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../api/api";

type AdminUser = { id: number; nome: string; email: string; tipo: string; totp_enabled?: boolean };

type SignInResult =
  | { requires2fa: true; pre_auth_token: string }
  | { requires2fa_setup: true; pre_auth_token: string; otpauth: string }
  | { requires2fa: false };

type AuthContextType = {
  user: AdminUser | null;
  signIn: (email: string, senha: string) => Promise<SignInResult>;
  verify2fa: (pre_auth_token: string, code: string) => Promise<void>;
  completeFirstSetup: (pre_auth_token: string, code: string) => Promise<void>;
  signOut: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

function loadUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem("admin_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(loadUser);

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) return;
    api.get("/auth/me")
      .then(({ data }) => {
        const validated = data.usuario as AdminUser;
        localStorage.setItem("admin_user", JSON.stringify(validated));
        setUser(validated);
      })
      .catch(() => {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
        setUser(null);
      });
  }, []);

  async function signIn(email: string, senha: string): Promise<SignInResult> {
    const { data } = await api.post("/auth/login", { email, senha });
    if (data.requires2fa) {
      return { requires2fa: true, pre_auth_token: data.pre_auth_token };
    }
    if (data.requires2fa_setup) {
      return { requires2fa_setup: true, pre_auth_token: data.pre_auth_token, otpauth: data.otpauth };
    }
    localStorage.setItem("admin_token", data.token);
    localStorage.setItem("admin_user", JSON.stringify(data.usuario));
    setUser(data.usuario);
    return { requires2fa: false };
  }

  async function verify2fa(pre_auth_token: string, code: string) {
    const { data } = await api.post("/auth/2fa/verify", { pre_auth_token, code });
    localStorage.setItem("admin_token", data.token);
    localStorage.setItem("admin_user", JSON.stringify(data.usuario));
    setUser(data.usuario);
  }

  async function completeFirstSetup(pre_auth_token: string, code: string) {
    const { data } = await api.post("/auth/2fa/first-setup", { pre_auth_token, code });
    localStorage.setItem("admin_token", data.token);
    localStorage.setItem("admin_user", JSON.stringify(data.usuario));
    setUser(data.usuario);
  }

  async function refreshMe() {
    try {
      const { data } = await api.get("/auth/me");
      const updated = { ...user, ...data.usuario } as AdminUser;
      localStorage.setItem("admin_user", JSON.stringify(updated));
      setUser(updated);
    } catch {}
  }

  function signOut() {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, signIn, verify2fa, completeFirstSetup, signOut, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
