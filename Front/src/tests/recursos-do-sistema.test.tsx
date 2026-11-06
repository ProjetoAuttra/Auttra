import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import RecursosSistema from "../modules/recursos-sistema/pages/RecursosSistema";

const ctx = vi.hoisted(() => ({
  resources: { agenda: true, estoque: true, fornecedores: false },
  loading: false,
  save: vi.fn(),
  podeEditar: true,
}));
vi.mock("../context/SystemResourcesContext", () => ({
  useSystemResources: () => ({ resources: ctx.resources, loading: ctx.loading, save: ctx.save }),
}));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ can: (_m: string, acao = "read") => acao === "read" || ctx.podeEditar }),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock("../context/ToastContext", () => ({ useToast: () => toast }));

beforeEach(() => {
  ctx.save.mockReset().mockImplementation(async (r: unknown) => r);
  ctx.podeEditar = true;
  Object.values(toast).forEach((fn) => fn.mockReset());
});

describe("Recursos do sistema", () => {
  it("mostra os módulos com o nome novo e quantos estão ativos", () => {
    renderWithProviders(<RecursosSistema />);
    expect(screen.getByRole("heading", { name: "Recursos do sistema" })).toBeInTheDocument();
    expect(screen.getByText(/2 de 3 ativos/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Ativar Fornecedores" })).not.toBeChecked();
  });

  it("liga um módulo e salva", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecursosSistema />);
    expect(screen.getByTestId("save-recursos")).toBeDisabled();

    await user.click(screen.getByRole("switch", { name: "Ativar Fornecedores" }));
    expect(screen.getByText(/3 de 3 ativos/)).toBeInTheDocument();
    await user.click(screen.getByTestId("save-recursos"));

    await waitFor(() => expect(ctx.save).toHaveBeenCalledWith({ agenda: true, estoque: true, fornecedores: true }));
    expect(toast.success).toHaveBeenCalledWith("Recursos do sistema salvos.");
  });

  it("sem permissão, os switches ficam bloqueados e não há Salvar", () => {
    ctx.podeEditar = false;
    renderWithProviders(<RecursosSistema />);
    expect(screen.getByRole("switch", { name: "Ativar Agenda" })).toBeDisabled();
    expect(screen.queryByTestId("save-recursos")).not.toBeInTheDocument();
  });
});
