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

export default api;
