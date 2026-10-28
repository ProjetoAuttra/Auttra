import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import api from "../api/api";
import NovoOrcamento from "../modules/orcamentos/pages/novoorcamento/novoorcamento";

vi.mock("../api/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), defaults: { headers: { common: {} } } },
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { oficina_id: 1 } }) }));
vi.mock("../components/common/CampoData", () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);

describe("NovoOrcamento (tela inteira)", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    get.mockImplementation(async (url: string) => ({ data: url.startsWith("/servicos") ? [{ id: 1, nome: "Troca de óleo", preco: 120 }] : [] }));
  });

  const setup = () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/orcamentos/novo"]}>
        <Routes>
          <Route path="/orcamentos/novo" element={<NovoOrcamento />} />
          <Route path="/orcamentos" element={<div>Lista de orçamentos</div>} />
          <Route path="/orcamentos/:id" element={<div>Detalhe do orçamento</div>} />
        </Routes>
      </MemoryRouter>
    );
    return userEvent.setup();
  };

  it("abre como página, com as seções e o resumo ao lado", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Novo orçamento" })).toBeInTheDocument();
    expect(screen.getByText("Cliente e veículo")).toBeInTheDocument();
    expect(screen.getByText("Itens do orçamento")).toBeInTheDocument();
    expect(screen.getByText("Detalhes do orçamento")).toBeInTheDocument();
    expect(screen.getByText("Resumo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /criar orçamento/i })).toBeInTheDocument();
  });

  it("sem cliente, veículo e valor não envia e mostra os erros", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: /criar orçamento/i }));
    expect(await screen.findByText("Selecione o cliente")).toBeInTheDocument();
    expect(screen.getByText("Informe um valor válido")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("adiciona um serviço, soma no resumo e remove", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: /mão de obra/i }));
    await user.click(await screen.findByLabelText(/selecionar serviço/i));
    await user.click(await screen.findByRole("option", { name: /troca de óleo/i }));
    await user.click(screen.getByRole("button", { name: /^adicionar$/i }));

    expect(await screen.findByText("Troca de óleo")).toBeInTheDocument();
    const valorTotal = screen.getByText("Valor total").nextElementSibling?.textContent?.replace(/\s/g, " ");
    expect(valorTotal).toBe("R$ 120,00");

    await user.click(screen.getByRole("button", { name: /remover troca de óleo/i }));
    expect(screen.queryByText("Troca de óleo")).toBeNull();
  });

  it("voltar sem nada preenchido vai direto para a lista", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await waitFor(() => expect(screen.getByText("Lista de orçamentos")).toBeInTheDocument());
  });
});
