import axios from "axios";

declare global {
  interface Window {
    __DRIVEON_CONFIG__?: {
      API_URL?: string;
      TURNSTILE_SITE_KEY?: string;
    };
  }
}

export const turnstileSiteKey =
  window.__DRIVEON_CONFIG__?.TURNSTILE_SITE_KEY ||
  import.meta.env.VITE_TURNSTILE_SITE_KEY ||
  "1x00000000000000000000AA";

function normalizeApiUrl(url: string) {
  const cleanUrl = url.replace(/\/+$/, "");
  if (!cleanUrl || cleanUrl === "/api" || cleanUrl.endsWith("/api")) return cleanUrl || "/api";
  return `${cleanUrl}/api`;
}

const api = axios.create({
  baseURL: normalizeApiUrl(window.__DRIVEON_CONFIG__?.API_URL ?? import.meta.env.VITE_API_URL ?? "/api"),
});

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("driveon:token") ?? sessionStorage.getItem("driveon:token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * A sessão deste navegador não vale mais: o token venceu (8h), foi adulterado ou foi revogado no servidor
 * (senha trocada, acesso removido). Usa as mensagens do ensureAuth do back; o 401 de senha errada no login
 * e o da seleção de oficina têm outras mensagens e não entram aqui. Só conta quando um token foi enviado.
 */
export function sessaoInvalida(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config?.headers?.Authorization) return false;
  const mensagem = error.response.data?.message;
  return typeof mensagem === "string" && (mensagem === "Token inválido" || mensagem.startsWith("Sessão encerrada"));
}

// Sessão inválida: limpa o login local e volta para a tela de entrada (que, sem token, não redireciona de volta).
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (sessaoInvalida(error)) {
      for (const storage of [localStorage, sessionStorage]) {
        storage.removeItem("driveon:token");
        storage.removeItem("driveon:user");
      }
      if (window.location.pathname !== "/login") window.location.assign("/login");
    }
    return Promise.reject(error);
  }
);

export default api;
