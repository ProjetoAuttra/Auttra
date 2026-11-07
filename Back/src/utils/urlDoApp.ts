/** Endereço do app das oficinas, para os links dos e-mails (redefinir senha, confirmar e-mail). */
export function urlDoApp() {
  const base =
    process.env.PASSWORD_RESET_URL_BASE?.trim() ||
    process.env.FRONTEND_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:5173";
  return base.replace(/\/+$/, "");
}
