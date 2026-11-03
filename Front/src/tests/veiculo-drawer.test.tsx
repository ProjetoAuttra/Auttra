import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import VeiculoDialog from "../modules/veiculos/dialog";

vi.mock("../api/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), defaults: { headers: { common: {} } } },
}));
vi.mock("../modules/veiculos/catalogo", async (orig) => {
  const m = await orig<typeof import("../modules/veiculos/catalogo")>();
  return { ...m, useCatalogo: () => m.CATALOGO_LOCAL };
});
vi.mock("../api/client", () => ({ listarClientes: vi.fn().mockResolvedValue([{ id: 1, nome: "Ana" }]) }));

// Digitar letra a letra num campo com centenas de sugestões é lento no runner do CI (limite padrão: 5 s).
describe("VeiculoDialog (marca, modelo e cor)", { timeout: 30_000 }, () => {
  const setup = () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <VeiculoDialog open mode="create" defaultCliente={{ id: 1, nome: "Ana" }} onClose={vi.fn()} onSubmit={onSubmit} />,
    );
    return { onSubmit, user: userEvent.setup() };
  };

  it("escolher o modelo preenche a marca", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("combobox", { name: /modelo/i }), "Onix");
    await user.click(await screen.findByRole("option", { name: "Onix" }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: /marca/i })).toHaveValue("Chevrolet"));
  });

  it("com a marca informada, o modelo só sugere os dela", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("combobox", { name: /marca/i }), "Fiat");
    await user.click(screen.getByRole("combobox", { name: /modelo/i }));
    expect(await screen.findByRole("option", { name: "Argo" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Onix" })).toBeNull();
  });

  it("a cor é escolhida pelas amostras e vai no envio", async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByRole("combobox", { name: /marca/i }), "Fiat");
    await user.type(screen.getByRole("combobox", { name: /modelo/i }), "Argo");
    await user.type(screen.getByLabelText(/placa/i), "ABC1D23");
    await user.click(screen.getByRole("radio", { name: "Vermelho" }));
    await user.click(screen.getByRole("button", { name: /cadastrar veículo/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ marca: "Fiat", modelo: "Argo", cor: "Vermelho" })));
  });

  it("apagar a marca apaga o modelo", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("combobox", { name: /marca/i }), "Fiat");
    await user.type(screen.getByRole("combobox", { name: /modelo/i }), "Argo");
    await user.clear(screen.getByRole("combobox", { name: /marca/i }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: /modelo/i })).toHaveValue(""));
  });

  it("apagar um modelo que preencheu a marca apaga a marca; marca digitada permanece", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("combobox", { name: /modelo/i }), "Onix");
    await user.click(await screen.findByRole("option", { name: "Onix" }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: /marca/i })).toHaveValue("Chevrolet"));
    await user.clear(screen.getByRole("combobox", { name: /modelo/i }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: /marca/i })).toHaveValue(""));

    await user.type(screen.getByRole("combobox", { name: /marca/i }), "Fiat");
    await user.type(screen.getByRole("combobox", { name: /modelo/i }), "Argo");
    await user.clear(screen.getByRole("combobox", { name: /modelo/i }));
    expect(screen.getByRole("combobox", { name: /marca/i })).toHaveValue("Fiat");
  });
});
