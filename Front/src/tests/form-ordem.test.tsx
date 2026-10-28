import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import api from "../api/api";
import FormOrdemServico from "../modules/tarefas/pages/formordem/formordem";

vi.mock("../api/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), defaults: { headers: { common: {} } } },
}));
vi.mock("../context/ToastContext", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }) }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { oficina_id: 1 } }) }));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);
const put = vi.mocked(api.put);
const patch = vi.mocked(api.patch);

const veiculo = { id: 5, modelo: "Onix", placa: "RST3U45" };
const funcionario = { id: 3, nome: "Marcos Pereira" };

describe("FormOrdemServico (tela inteira)", () => {
  beforeEach(() => {
    [get, post, put, patch].forEach((m) => m.mockReset());
    get.mockImplementation(async (url: string) => {
      if (url === "/funcionarios") return { data: [funcionario] };
      if (url === "/servicos") return { data: [{ id: 1, nome: "Troca de óleo", preco: 150 }] };
      if (url === "/veiculos") return { data: [veiculo] };
      if (url === "/ordens/9") return { data: { id: 9, cliente_id: 1, cliente: { id: 1, nome: "Ana Costa" }, veiculo_id: 5, funcionario_id: 3, observacoes: "Revisão", itens: [{ id: 1, tipo_item: "servico", nome: "Alinhamento", servico_id: 2, quantidade: 2, preco_unitario: 100, subtotal: 200 }] } };
      return { data: [] };
    });
    post.mockResolvedValue({ data: { id: 77 } });
    put.mockResolvedValue({ data: { id: 9 } });
    patch.mockResolvedValue({ data: {} });
  });

  const setup = (entrada: string | { pathname: string; state: unknown }) => {
    renderWithProviders(
      <MemoryRouter initialEntries={[entrada]}>
        <Routes>
          <Route path="/ordens/nova" element={<FormOrdemServico />} />
          <Route path="/ordens/:id/editar" element={<FormOrdemServico />} />
          <Route path="/ordens/:id" element={<div>Detalhe da OS</div>} />
          <Route path="/tarefas" element={<div>Lista de OS</div>} />
        </Routes>
      </MemoryRouter>
    );
    return userEvent.setup();
  };

  it("nova OS abre como página, com seções e resumo, e exige cliente, veículo e responsável", async () => {
    const user = setup("/ordens/nova");
    expect(screen.getByRole("heading", { name: "Nova ordem de serviço" })).toBeInTheDocument();
    expect(screen.getByText("Itens da ordem de serviço")).toBeInTheDocument();
    expect(screen.getByText("Resumo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /gerar ordem de serviço/i }));
    expect(await screen.findByText("Selecione o cliente")).toBeInTheDocument();
    expect(screen.getByText("Selecione o veículo")).toBeInTheDocument();
    expect(screen.getByText("Selecione o responsável")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("vindo de um orçamento, abre preenchida, cria a OS e aprova o orçamento", async () => {
    const user = setup({
      pathname: "/ordens/nova",
      state: {
        cliente_id: 1,
        cliente: { id: 1, nome: "Ana Costa" },
        veiculo_id: 5,
        funcionario_id: 0,
        observacoes: "Convertido do orçamento #4: Freios",
        itens: [{ tipo_item: "servico", nome: "Freios e discos", servico_id: 7, quantidade: 1, preco_unitario: 860, subtotal: 860 }],
        orcamento_id: 4,
      },
    });
    expect(await screen.findByText("Gerada a partir do orçamento #4.")).toBeInTheDocument();
    expect(screen.getByText("Freios e discos")).toBeInTheDocument();
    expect(screen.getByLabelText("Observações")).toHaveValue("Convertido do orçamento #4: Freios");

    await user.click(await screen.findByLabelText(/responsável/i));
    await user.click(await screen.findByRole("option", { name: "Marcos Pereira" }));
    await user.click(screen.getByRole("button", { name: /gerar ordem de serviço/i }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][1]).toMatchObject({ cliente_id: 1, veiculo_id: 5, funcionario_id: 3, valor_total: 860 });
    expect(patch).toHaveBeenCalledWith("/orcamentos/4/status", { status: "aprovado" });
    expect(await screen.findByText("Detalhe da OS")).toBeInTheDocument();
  });

  it("editar carrega a OS e salva com PUT", async () => {
    const user = setup("/ordens/9/editar");
    expect(await screen.findByRole("heading", { name: "Editar ordem de serviço #9" })).toBeInTheDocument();
    expect(await screen.findByText("Alinhamento")).toBeInTheDocument();
    expect(screen.getByLabelText("Observações")).toHaveValue("Revisão");

    await user.click(screen.getByRole("button", { name: /salvar alterações/i }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0][0]).toBe("/ordens/9");
    expect(put.mock.calls[0][1]).toMatchObject({ cliente_id: 1, veiculo_id: 5, funcionario_id: 3, valor_total: 200 });
    expect(await screen.findByText("Detalhe da OS")).toBeInTheDocument();
  });
});
