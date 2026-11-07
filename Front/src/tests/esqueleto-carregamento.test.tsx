import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import api from "../api/api";
import Clientes from "../modules/clientes/pages/Clientes";

vi.mock("../api/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), defaults: { headers: { common: {} } } },
}));
vi.mock("../context/ToastContext", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }) }));
vi.mock("../context/ConfirmContext", () => ({ useConfirm: () => vi.fn(async () => true) }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { oficina_id: 1 }, can: () => true }) }));

const get = vi.mocked(api.get);

describe("lista carregando", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("mostra a tela de verdade com o corpo da tabela em esqueleto, sem spinner", async () => {
    let responder: (v: unknown) => void = () => {};
    get.mockImplementation(() => new Promise((r) => { responder = r; }));

    renderWithProviders(<MemoryRouter><Clientes /></MemoryRouter>);

    // Cabeçalho, busca e botão já aparecem enquanto os dados não chegam.
    expect(screen.getByText("Clientes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cliente" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Nome" })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    responder({ data: [{ id: 1, nome: "Ana Souza", email: "", telefone: "" }], headers: { "x-total-count": "1" } });
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
  });
});
