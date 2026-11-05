import * as React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import api from "../api/api";
import Login from "../modules/autenticacao/pages/Login";
import { PrivateRoute } from "../app/Router";
import { destinoAposLogin } from "../routes/navegacao";

vi.mock("../api/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), defaults: { headers: { common: {} } } },
  turnstileSiteKey: "chave-teste",
}));

// O desafio do Turnstile é externo: no teste ele já devolve um token válido.
vi.mock("../components/common/TurnstileWidget", () => ({
  default: function TurnstileFalso({ onVerify }: { onVerify: (t: string) => void }) {
    React.useEffect(() => onVerify("token-turnstile"), [onVerify]);
    return null;
  },
}));

const auth = vi.hoisted(() => ({ isAuthenticated: false, signIn: vi.fn(), selectOffice: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));

function Onde() {
  const { pathname, search } = useLocation();
  return <div data-testid="onde">{pathname + search}</div>;
}

const setup = (inicio: string) =>
  renderWithProviders(
    <MemoryRouter initialEntries={[inicio]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<PrivateRoute><Onde /></PrivateRoute>} />
      </Routes>
    </MemoryRouter>
  );

describe("login volta para a tela pedida", () => {
  beforeEach(() => {
    auth.isAuthenticated = false;
    auth.signIn.mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.post).mockResolvedValue({ data: { emailToken: "email-token" } });
    auth.signIn.mockImplementation(async () => {
      auth.isAuthenticated = true;
      return { requiresOfficeSelection: false };
    });
  });

  it("sem sessão, /clientes/12?aba=os vai ao login e, depois de entrar, volta para lá", async () => {
    const user = userEvent.setup();
    setup("/clientes/12?aba=os");

    await user.type(await screen.findByLabelText("E-mail"), "ana@oficina.com");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.type(await screen.findByLabelText("Senha"), "segredo");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByTestId("onde")).toHaveTextContent("/clientes/12?aba=os");
    expect(auth.signIn).toHaveBeenCalledWith("ana@oficina.com", "segredo", false, "email-token");
  });
});

describe("destinoAposLogin", () => {
  it("aceita só caminhos internos e cai no início nos demais casos", () => {
    expect(destinoAposLogin({ from: { pathname: "/ordens/5", search: "", hash: "" } })).toBe("/ordens/5");
    expect(destinoAposLogin({ from: "/contas-receber?situacao=vencido" })).toBe("/contas-receber?situacao=vencido");
    expect(destinoAposLogin(null)).toBe("/");
    expect(destinoAposLogin({ from: "https://exemplo.com" })).toBe("/");
    expect(destinoAposLogin({ from: "//exemplo.com" })).toBe("/");
    expect(destinoAposLogin({ from: "/\\exemplo.com" })).toBe("/");
    expect(destinoAposLogin({ from: { pathname: "/login" } })).toBe("/");
  });
});
