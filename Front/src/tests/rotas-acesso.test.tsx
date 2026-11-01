import { Suspense } from "react";
import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import { ModuleRoute } from "../app/Router";
import type { AccessModule } from "../permissions/accessProfiles";

vi.mock("../api/api", () => ({ default: { get: vi.fn(), post: vi.fn(), defaults: { headers: { common: {} } } }, turnstileSiteKey: "x" }));

const perm = vi.hoisted(() => ({ modulos: [] as string[] }));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ can: (m: string) => perm.modulos.includes(m), signOut: vi.fn() }),
}));
vi.mock("../context/AdditionalResourcesContext", () => ({ useAdditionalResources: () => ({ isEnabled: () => true }) }));

function Onde() {
  const { pathname } = useLocation();
  return <div data-testid="onde">{pathname}</div>;
}

const setup = (modulos: AccessModule[]) => {
  perm.modulos = modulos;
  renderWithProviders(
    <MemoryRouter initialEntries={["/"]}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<ModuleRoute module="painel"><div>Painel</div></ModuleRoute>} />
          <Route path="/clientes" element={<ModuleRoute module="clientes"><Onde /></ModuleRoute>} />
          <Route path="/tarefas" element={<ModuleRoute module="ordens"><Onde /></ModuleRoute>} />
        </Routes>
      </Suspense>
    </MemoryRouter>
  );
};

describe("rota sem permissão", () => {
  it("perfil sem o painel vai para a primeira tela liberada, na ordem do menu", async () => {
    setup(["ordens", "clientes"]);
    expect(await screen.findByTestId("onde")).toHaveTextContent("/clientes");
  });

  it("perfil sem nenhuma tela liberada vê 'Sem acesso' em vez de loop ou tela em branco", async () => {
    setup([]);
    expect(await screen.findByText("Sem acesso")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });
});
