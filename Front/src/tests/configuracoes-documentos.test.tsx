import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import api from "../api/api";
import Configuracoes from "../modules/configuracoes/pages/configuracoes";

vi.mock("../api/api", () => ({
  default: { get: vi.fn(), put: vi.fn(), defaults: { headers: { common: {} } } },
}));
// Funções estáveis: a página recarrega as configurações quando `error` muda de identidade.
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock("../context/ToastContext", () => ({ useToast: () => toast }));

const get = vi.mocked(api.get);
const put = vi.mocked(api.put);

describe("Configurações > Orçamentos e OS", () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
    Object.values(toast).forEach((fn) => fn.mockReset());
    get.mockImplementation(async (url: string) => ({
      data: url === "/configuracoes/documentos" ? { garantiaDias: 180, validadeOrcamentoDias: 15, observacoes: "Estadia após 30 dias." } : {},
    }));
    put.mockImplementation(async (_url: string, body: unknown) => ({ data: body }));
  });

  const setup = () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/configuracoes?section=documentos"]}>
        <Configuracoes />
      </MemoryRouter>
    );
    return userEvent.setup();
  };

  it("mostra a garantia, a validade e as observações salvas", async () => {
    setup();
    expect(await screen.findByText("180 dias")).toBeInTheDocument();
    expect(screen.getByText("15 dias")).toBeInTheDocument();
    expect(screen.getByText("Estadia após 30 dias.")).toBeInTheDocument();
  });

  it("não salva garantia menor que 90 dias e explica o motivo", async () => {
    const user = setup();
    await user.click(await screen.findByTestId("edit-documentos"));
    const garantia = screen.getByTestId("garantia-dias");
    await user.clear(garantia);
    await user.type(garantia, "30");
    await user.click(screen.getByTestId("save-documentos"));

    expect(await screen.findByText(/mínimo de 90 dias \(garantia legal\)/i)).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it("salva o prazo novo e volta para a visualização", async () => {
    const user = setup();
    await user.click(await screen.findByTestId("edit-documentos"));
    const garantia = screen.getByTestId("garantia-dias");
    await user.clear(garantia);
    await user.type(garantia, "365");
    await user.click(screen.getByTestId("save-documentos"));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("/configuracoes/documentos", { garantiaDias: 365, validadeOrcamentoDias: 15, observacoes: "Estadia após 30 dias." })
    );
    expect(await screen.findByText("365 dias")).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalled();
  });

  it("cancelar descarta o que foi digitado", async () => {
    const user = setup();
    await user.click(await screen.findByTestId("edit-documentos"));
    const garantia = screen.getByTestId("garantia-dias");
    await user.clear(garantia);
    await user.type(garantia, "999");
    await user.click(screen.getByTestId("cancel-documentos"));

    expect(await screen.findByText("180 dias")).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });
});
