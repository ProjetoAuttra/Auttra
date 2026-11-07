import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import AppSidebar from "../components/layout/AppSidebar";

const sidebar = vi.hoisted(() => ({ collapsed: true }));
vi.mock("../context/SidebarContext", () => ({
  useSidebar: () => ({ collapsed: sidebar.collapsed, toggleCollapsed: vi.fn(), setCollapsed: vi.fn() }),
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ can: () => true }) }));
vi.mock("../context/SystemResourcesContext", () => ({ useSystemResources: () => ({ isEnabled: () => true }) }));

function Onde() {
  const { pathname } = useLocation();
  return <div data-testid="onde">{pathname}</div>;
}

const setup = (inicio: string, collapsed = true) => {
  sidebar.collapsed = collapsed;
  renderWithProviders(
    <MemoryRouter initialEntries={[inicio]}>
      <AppSidebar drawerWidth={248} />
      <Onde />
    </MemoryRouter>
  );
  return userEvent.setup();
};

// O drawer do celular fica montado (e oculto) ao lado do permanente; as consultas por papel
// ignoram o oculto, então os botões encontrados são os da barra do desktop.
describe("barra lateral recolhida", () => {
  it("Financeiro abre um menu com Extrato, Recebimentos e Pagamentos e navega pelo subitem", async () => {
    const user = setup("/");
    await user.click(screen.getByRole("button", { name: "Financeiro" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Extrato", "Recebimentos", "Pagamentos"]);

    await user.click(within(menu).getByRole("menuitem", { name: "Recebimentos" }));
    expect(screen.getByTestId("onde")).toHaveTextContent("/contas-receber");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("Catálogo abre Peças, Serviços e Fornecedores, com o subitem atual marcado", async () => {
    const user = setup("/fornecedores");
    const catalogo = screen.getByRole("button", { name: "Catálogo" });
    expect(catalogo).toHaveClass("Mui-selected");
    await user.click(catalogo);
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Peças", "Serviços", "Fornecedores"]);
    expect(within(menu).getByRole("menuitem", { name: "Fornecedores" })).toHaveClass("Mui-selected");
    expect(within(menu).getByRole("menuitem", { name: "Peças" })).not.toHaveClass("Mui-selected");
  });
});

describe("item ativo da barra lateral", () => {
  it.each([
    ["/ordens/5", "Ordens de serviço"],
    ["/ordens/5/editar", "Ordens de serviço"],
    ["/clientes/12", "Clientes"],
    ["/orcamentos/novo", "Orçamentos"],
    ["/relatorios/estoque", "Relatórios"],
  ])("em %s marca %s", (caminho, item) => {
    setup(caminho, false);
    expect(screen.getByRole("button", { name: item })).toHaveClass("Mui-selected");
    expect(screen.getByRole("button", { name: "Início" })).not.toHaveClass("Mui-selected");
  });
});
