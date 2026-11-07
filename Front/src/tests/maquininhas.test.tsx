import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import api from "../api/api";
import { ReceberTituloDialog } from "../modules/pagamentos/dialogs/TituloDialogs";
import { MaquininhaDialog } from "../modules/configuracoes/secoes/CartaoMaquininhas";
import type { Conta } from "../modules/pagamentos/api/api";
import type { Maquininha } from "../modules/configuracoes/api/maquininhas";

vi.mock("../components/common/CampoData", () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock("../api/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), defaults: { headers: { common: {} } } },
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock("../context/ToastContext", () => ({ useToast: () => toast }));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);

const stone: Maquininha = {
  id: 1, nome: "Stone balcão", operadora: "stone", ativo: true, aceita_debito: true, aceita_credito: true,
  taxa_debito: 1.5, prazo_debito_dias: 1, taxas_credito: [3, 4, 5], prazo_credito_dias: 30, intervalo_parcelas_dias: 30, antecipacao: false,
};
const cielo: Maquininha = { ...stone, id: 2, nome: "Cielo", operadora: "cielo", taxas_credito: [2.5] };

const conta: Conta = {
  id: 9, tipo: "receber", status: "pendente", valor: 300, valor_original: 300, desconto: 0, valor_pago: 0,
  data_vencimento: "2026-11-01T00:00:00.000Z", vezes_renegociado: 0, descricao: "Revisão", cliente: { id: 1, nome: "Ana" },
};

const abrirReceber = async (maquininhas: Maquininha[], tipo: "receber" | "pagar" = "receber") => {
  get.mockResolvedValue({ data: maquininhas });
  const onConfirm = vi.fn(async () => {});
  const user = userEvent.setup();
  renderWithProviders(<ReceberTituloDialog open onClose={() => {}} conta={{ ...conta, tipo }} tipo={tipo} onConfirm={onConfirm} />);
  const escolher = async (campo: RegExp, opcao: string | RegExp) => {
    await user.click(screen.getByRole("combobox", { name: campo }));
    await user.click(await screen.findByRole("option", { name: opcao }));
  };
  return { user, onConfirm, escolher, botao: () => screen.getByRole("button", { name: /confirmar/i }) };
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  Object.values(toast).forEach((fn) => fn.mockReset());
});

describe("receber no cartão com maquininha", () => {
  it("exige a maquininha, mostra taxa e líquido da parcela escolhida e envia tudo", async () => {
    const { escolher, onConfirm, botao, user } = await abrirReceber([stone, cielo]);
    await escolher(/método/i, "Cartão de crédito");

    expect(await screen.findByText("Escolha a maquininha usada")).toBeInTheDocument();
    expect(botao()).toBeDisabled();

    await escolher(/maquininha/i, "Stone balcão");
    await escolher(/parcelas/i, /^3x/);

    expect(screen.getByText("Taxa da maquininha (5%)")).toBeInTheDocument();
    expect(screen.getByText(/− R\$\s15,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s285,00/)).toBeInTheDocument();

    await user.click(botao());
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ metodo: "cartao_credito", maquininha_id: 1, cartao_parcelas: 3, valor: 300 }))
    );
  });

  it("a previsão usa o intervalo entre parcelas da maquininha", async () => {
    const { escolher, user } = await abrirReceber([{ ...stone, intervalo_parcelas_dias: 28 }]);
    await user.clear(screen.getByLabelText(/data do recebimento/i));
    await user.type(screen.getByLabelText(/data do recebimento/i), "2026-11-10");
    await escolher(/método/i, "Cartão de crédito");
    await escolher(/parcelas/i, /^3x/);
    expect(await screen.findByText("04/02/2027")).toBeInTheDocument(); // 30 + 28 + 28 dias
  });

  it("com uma maquininha só, ela já vem escolhida; no débito não pergunta parcelas", async () => {
    const { escolher, onConfirm, botao, user } = await abrirReceber([stone]);
    await escolher(/método/i, "Cartão de débito");

    await screen.findByText("Taxa da maquininha (1,5%)");
    expect(screen.queryByRole("combobox", { name: /parcelas/i })).not.toBeInTheDocument();

    await user.click(botao());
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ maquininha_id: 1, cartao_parcelas: 1 })));
  });

  it("só aparecem as maquininhas que aceitam o método escolhido", async () => {
    const link: Maquininha = { ...cielo, id: 3, nome: "Link de pagamento", aceita_debito: false };
    const { escolher, user } = await abrirReceber([stone, link]);

    await escolher(/método/i, "Cartão de débito");
    // Só a Stone aceita débito: já vem escolhida e o link nem aparece.
    await screen.findByText("Taxa da maquininha (1,5%)");
    await user.click(screen.getByRole("combobox", { name: /maquininha/i }));
    const lista = await screen.findByRole("listbox");
    expect(within(lista).queryByRole("option", { name: "Link de pagamento" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await escolher(/método/i, "Cartão de crédito");
    await user.click(screen.getByRole("combobox", { name: /maquininha/i }));
    expect(within(await screen.findByRole("listbox")).getByRole("option", { name: "Link de pagamento" })).toBeInTheDocument();
  });

  it("sem maquininha cadastrada, recebe no cartão como antes", async () => {
    const { escolher, onConfirm, botao, user } = await abrirReceber([]);
    await escolher(/método/i, "Cartão de crédito");
    expect(screen.queryByRole("combobox", { name: /maquininha/i })).not.toBeInTheDocument();
    await user.click(botao());
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(expect.not.objectContaining({ maquininha_id: expect.anything() })));
  });

  it("conta a pagar no cartão não usa maquininha", async () => {
    const { escolher } = await abrirReceber([stone], "pagar");
    await escolher(/método/i, "Cartão de crédito");
    expect(screen.queryByRole("combobox", { name: /maquininha/i })).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});

describe("configurar maquininha", () => {
  it("escolher a operadora preenche o nome, e o número de parcelas define as taxas pedidas", async () => {
    post.mockImplementation(async (_url: string, body: any) => ({ data: { id: 7, ...body } }));
    const onSalva = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<MaquininhaDialog open maquininha={null} onClose={() => {}} onSalva={onSalva} />);

    await user.click(screen.getByRole("combobox", { name: /operadora/i }));
    await user.click(within(await screen.findByRole("listbox")).getByRole("option", { name: "Rede" }));
    expect(screen.getByRole("textbox", { name: /nome/i })).toHaveValue("Rede");

    await user.click(screen.getByRole("combobox", { name: /parcela em até/i }));
    await user.click(await screen.findByRole("option", { name: "3x" }));
    expect(screen.getAllByRole("textbox", { name: /taxa do crédito/i })).toHaveLength(3);

    const debito = screen.getByRole("textbox", { name: /taxa do débito/i });
    await user.clear(debito);
    await user.type(debito, "1,99");
    const tresVezes = screen.getByRole("textbox", { name: "Taxa do crédito em 3x" });
    await user.clear(tresVezes);
    await user.type(tresVezes, "6,5");

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/configuracoes/maquininhas",
        expect.objectContaining({ nome: "Rede", operadora: "rede", taxa_debito: 1.99, taxas_credito: [0, 0, 6.5] })
      )
    );
    expect(onSalva).toHaveBeenCalled();
  });

  it("desligar o débito esconde a parte dele e mantém os valores salvos", async () => {
    vi.mocked(api.put).mockImplementation(async (_url: string, body: any) => ({ data: { ...stone, ...body } }));
    const user = userEvent.setup();
    renderWithProviders(<MaquininhaDialog open maquininha={stone} onClose={() => {}} onSalva={() => {}} />);

    await user.click(screen.getByLabelText("Débito"));
    expect(screen.queryByRole("textbox", { name: /taxa do débito/i })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Taxa do crédito à vista" })).toBeInTheDocument();

    await user.click(screen.getByLabelText("Crédito"));
    expect(screen.getByText("Ligue débito, crédito ou os dois.")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Crédito"));

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        "/configuracoes/maquininhas/1",
        expect.objectContaining({ aceita_debito: false, aceita_credito: true, taxa_debito: 1.5, prazo_debito_dias: 1 })
      )
    );
  });

  it("intervalo entre parcelas só aparece no parcelado sem antecipação", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MaquininhaDialog open maquininha={stone} onClose={() => {}} onSalva={() => {}} />);
    expect(screen.getByRole("spinbutton", { name: /demais parcelas a cada/i })).toHaveValue(30);
    await user.click(screen.getByLabelText(/antecipação automática/i));
    expect(screen.queryByRole("spinbutton", { name: /demais parcelas a cada/i })).not.toBeInTheDocument();
  });

  it("não salva sem nome nem com taxa vazia", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MaquininhaDialog open maquininha={stone} onClose={() => {}} onSalva={() => {}} />);
    await user.clear(screen.getByRole("textbox", { name: /nome/i }));
    await user.clear(screen.getByRole("textbox", { name: "Taxa do crédito à vista" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Informe o nome")).toBeInTheDocument();
    expect(screen.getByText(/Preencha todas as taxas/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
