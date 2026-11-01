import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import api from "../api/api";
import PendingTasks from "../modules/tarefas/pages/PendingTasks";
import OrcamentosPage from "../modules/orcamentos/pages/orcamentos";
import FiltrosContas, { paramsFiltros, useFiltrosContas } from "../modules/pagamentos/components/FiltrosContas";

vi.mock("../api/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), defaults: { headers: { common: {} } } },
}));
vi.mock("../context/ToastContext", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }) }));
vi.mock("../context/ConfirmContext", () => ({ useConfirm: () => vi.fn(async () => true) }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { oficina_id: 1 }, can: () => true }) }));

const get = vi.mocked(api.get);

function Onde() {
  const { pathname, search } = useLocation();
  return <div data-testid="onde">{pathname + search}</div>;
}

const render = (inicio: string, rota: string, elemento: React.ReactNode) =>
  renderWithProviders(
    <MemoryRouter initialEntries={[inicio]}>
      <Routes>
        <Route path={rota} element={<>{elemento}<Onde /></>} />
      </Routes>
    </MemoryRouter>
  );

const paramsDaChamada = (endpoint: string) =>
  get.mock.calls.filter(([url]) => url === endpoint).map(([, cfg]) => (cfg as { params?: Record<string, unknown> })?.params ?? {});

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: [], headers: { "x-total-count": "0" } });
});

describe("filtro pela URL", () => {
  it("O.S.: ?status=aberta filtra na montagem e trocar a situação atualiza a URL", async () => {
    const user = userEvent.setup();
    render("/tarefas?status=aberta", "/tarefas", <PendingTasks />);
    await waitFor(() => expect(paramsDaChamada("/ordens")[0]).toMatchObject({ status: "aberta" }));

    await user.click(screen.getByRole("button", { name: /Filtros/ }));
    // Primeiro select do painel é a situação (o Select do MUI não liga o rótulo ao combobox).
    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByRole("option", { name: "Concluída" }));
    expect(screen.getByTestId("onde")).toHaveTextContent("/tarefas?status=concluida");
    await waitFor(() => expect(paramsDaChamada("/ordens").at(-1)).toMatchObject({ status: "concluida" }));
  });

  it("Orçamentos: ?status=analise traz os em análise sem limite de período", async () => {
    render("/orcamentos?status=analise", "/orcamentos", <OrcamentosPage />);
    await waitFor(() => expect(paramsDaChamada("/orcamentos")[0]).toMatchObject({ status: "analise" }));
    expect(paramsDaChamada("/orcamentos")[0]).not.toHaveProperty("data_de");
    expect(paramsDaChamada("/orcamentos")[0]).not.toHaveProperty("data_ate");
  });

  it("Contas: ?situacao=vencido abre com Vencidos marcado, sem período, e avisa na tela", async () => {
    let params: Record<string, string> = {};
    function Contas() {
      const [filtros, setFiltros] = useFiltrosContas();
      params = paramsFiltros(filtros, "cliente_id") as Record<string, string>;
      return <FiltrosContas filtros={filtros} onChange={setFiltros} tipo="receber" rotuloParceiro="Cliente" parceiros={[]} />;
    }
    const user = userEvent.setup();
    render("/contas-receber?situacao=vencido", "/contas-receber", <Contas />);

    expect(params).toMatchObject({ status: "vencido", vencimento_de: "", vencimento_ate: "" });
    expect(screen.getByText("Vencidos: todos os períodos")).toBeInTheDocument();

    // Limpar volta ao padrão e tira a situação da URL.
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByTestId("onde")).toHaveTextContent(/^\/contas-receber$/);
    expect(params.status).toBe("");
    expect(params.vencimento_de).not.toBe("");
    expect(screen.queryByText("Vencidos: todos os períodos")).not.toBeInTheDocument();
  });
});
