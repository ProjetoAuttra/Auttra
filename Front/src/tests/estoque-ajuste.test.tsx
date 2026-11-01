import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import api from "../api/api";
import { ajustarEstoque } from "../modules/estoque/api/api";
import EstoquePage from "../modules/estoque/pages/estoque";

vi.mock("../api/api", () => ({ default: { get: vi.fn(), defaults: { headers: { common: {} } } } }));
vi.mock("../modules/estoque/api/api", () => ({
  criarEstoque: vi.fn(),
  atualizarEstoque: vi.fn(),
  excluirEstoque: vi.fn(),
  ajustarEstoque: vi.fn(),
}));
vi.mock("../context/ToastContext", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }) }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { oficina_id: 1 } }) }));
vi.mock("../context/ConfirmContext", () => ({ useConfirm: () => vi.fn().mockResolvedValue(true) }));

const pecas = [
  { id: 1, nome: "Filtro de óleo", preco_custo: 10, preco_venda: 20, estoque: 4, created_at: "2026-10-01T10:00:00.000Z" },
  { id: 2, nome: "Pastilha de freio", preco_custo: 50, preco_venda: 90, estoque: 12, created_at: "2026-10-01T10:00:00.000Z" },
];

const ajustar = vi.mocked(ajustarEstoque);

async function abrirAjuste(tipo: "entrada" | "saída", linha = 0) {
  const user = userEvent.setup();
  renderWithProviders(<MemoryRouter><EstoquePage /></MemoryRouter>);
  await screen.findByText("Filtro de óleo");
  await user.click(screen.getAllByRole("button", { name: `Registrar ${tipo}` })[linha]);
  const campo = screen.getByLabelText("Quantidade") as HTMLInputElement;
  const confirmar = () => screen.getByRole("button", { name: "Confirmar" }) as HTMLButtonElement;
  return { user, campo, confirmar };
}

describe("ajuste de estoque: quantidade", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockResolvedValue({ data: pecas, headers: { "x-total-count": "2" } });
    ajustar.mockReset();
    ajustar.mockResolvedValue({});
  });

  it("apagar o campo não volta para 1: digitar 5 em seguida vira 5, não 15", async () => {
    const { user, campo, confirmar } = await abrirAjuste("entrada");
    expect(campo.value).toBe("1");

    await user.clear(campo);
    expect(campo.value).toBe("");
    await user.type(campo, "5");
    expect(campo.value).toBe("5");

    await user.click(confirmar());
    expect(ajustar).toHaveBeenCalledWith(1, "entrada", 5);
  });

  it("vazio ou zero só é recusado ao confirmar, com erro no campo", async () => {
    const { user, campo, confirmar } = await abrirAjuste("entrada");
    await user.clear(campo);
    expect(screen.queryByText(/número inteiro maior que zero/i)).toBeNull();

    await user.click(confirmar());
    expect(screen.getByText(/número inteiro maior que zero/i)).toBeInTheDocument();
    expect(campo).toHaveAttribute("aria-invalid", "true");

    await user.type(campo, "0");
    await user.click(confirmar());
    expect(screen.getByText(/número inteiro maior que zero/i)).toBeInTheDocument();
    expect(ajustar).not.toHaveBeenCalled();
  });

  it("na saída, mais do que o disponível é bloqueado com erro no campo", async () => {
    const { user, campo, confirmar } = await abrirAjuste("saída");
    await user.clear(campo);
    await user.type(campo, "5"); // disponível: 4

    expect(screen.getByText("Máximo disponível: 4")).toBeInTheDocument();
    expect(confirmar().disabled).toBe(true);

    await user.clear(campo);
    await user.type(campo, "4");
    await user.click(confirmar());
    expect(ajustar).toHaveBeenCalledWith(1, "saida", 4);
  });

  it("ajusta a peça da linha clicada (não a última editada)", async () => {
    const { user, confirmar } = await abrirAjuste("entrada", 1);
    await user.click(confirmar());
    expect(ajustar).toHaveBeenCalledWith(2, "entrada", 1);
  });

  it("trava o botão enquanto salva: clique duplo registra uma vez só", async () => {
    let resolver!: () => void;
    ajustar.mockReturnValue(new Promise((res) => { resolver = () => res({}); }));
    const { user, confirmar } = await abrirAjuste("entrada");
    const botao = confirmar();

    await user.dblClick(botao);
    expect(ajustar).toHaveBeenCalledTimes(1);
    expect(botao.disabled).toBe(true);

    resolver();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull());
  });
});
