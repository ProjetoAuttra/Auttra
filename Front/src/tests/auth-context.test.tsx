import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { renderWithProviders } from "./utils";
import api from "../api/api";

vi.mock("../api/api", () => ({
  default: {
    post: vi.fn(),
    defaults: { headers: { common: {} as Record<string, string> } },
  },
}));

function AuthProbe() {
  const auth = useAuth();

  return (
    <div>
      <span data-testid="auth">{auth.isAuthenticated ? "yes" : "no"}</span>
      <span data-testid="can-clientes">{auth.can("clientes") ? "yes" : "no"}</span>
      <button onClick={() => auth.signIn("user@test.com", "secret", true)}>login</button>
      <button onClick={auth.signOut}>logout</button>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
    api.defaults.headers.common = {};
  });

  it("persists token and permissions after login", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        token: "token-123",
        usuario: {
          id: 1,
          email: "user@test.com",
          nome: "Teste",
          tipo: "recepcao",
          oficina_id: 1,
          permissoes: { clientes: ["read"] },
        },
      },
    });

    renderWithProviders(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(screen.getByTestId("auth")).toHaveTextContent("no");

    await userEvent.click(screen.getByRole("button", { name: "login" }));

    expect(screen.getByTestId("auth")).toHaveTextContent("yes");
    expect(screen.getByTestId("can-clientes")).toHaveTextContent("yes");
    expect(localStorage.getItem("driveon:token")).toBe("token-123");
    expect(api.defaults.headers.common.Authorization).toBe("Bearer token-123");
  });

  it("clears storage and auth header on logout", async () => {
    localStorage.setItem("driveon:token", "token-123");
    localStorage.setItem(
      "driveon:user",
      JSON.stringify({ id: 1, email: "a@b.com", nome: "A", tipo: "recepcao", oficina_id: 1, oficinaId: 1 })
    );
    api.defaults.headers.common.Authorization = "Bearer token-123";

    renderWithProviders(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "logout" }));

    expect(screen.getByTestId("auth")).toHaveTextContent("no");
    expect(localStorage.getItem("driveon:token")).toBeNull();
    expect(api.defaults.headers.common.Authorization).toBeUndefined();
  });
});
