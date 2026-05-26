import axios from "axios";

declare global {
  interface Window {
    __ADMIN_CONFIG__?: { API_URL?: string };
  }
}

const api = axios.create({
  baseURL: (window.__ADMIN_CONFIG__?.API_URL ?? "/api").replace(/\/+$/, "") + "/admin",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
