import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import api from "../api/api";
import { DetalhesDialog, EstornarDialog, MovimentosDialog, ReceberDialog } from "../modules/pagamentos/dialogs";
import { formatarData, type Conta } from "../modules/pagamentos/api/api";

vi.mock("../api/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), defaults: { headers: { common: {} } } },
}));

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\s/g, " ");

describe("ReceberDialog", () => {
  const setup = (props: Partial<React.ComponentProps<typeof ReceberDialog>> = {}) => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <ReceberDialog open onClose={() => {}} onConfirm={onConfirm} saldoRestante={100} tipo="receber" {...props} />
    );
    return { onConfirm };
  };
  const campoValor = () => screen.getByLabelText(/valor recebido/i) as HTMLInputElement;
  const digitar = async (texto: string) => {
    const user = userEvent.setup();
    await user.clear(campoValor());
    await user.type(campoValor(), texto);
    return user;
  };

  it("abre com o saldo inteiro preenchido e confirma o recebimento total", async () => {
    const { onConfirm } = setup();

    expect(campoValor().value).toBe("100.00");
    await userEvent.setup().click(screen.getByRole("button", { name: /confirmar recebimento/i }));

    expect(onConfirm).toHaveBeenCalledWith({ metodo: "pix", valor: 100, data_pagamento: undefined });
  });

  it("valor menor que o saldo vira recebimento parcial (sem campo de data)", async () => {
    const { onConfirm } = setup();
    const user = await digitar("40");

    expect(screen.getByText(/recebimento parcial — restará/i)).toBeTruthy();
    expect(screen.queryByLabelText(/data do recebimento/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: /registrar recebimento parcial/i }));
    expect(onConfirm).toHaveBeenCalledWith({ metodo: "pix", valor: 40, data_pagamento: undefined });
  });

  it("valor maior que o saldo, zero ou vazio bloqueia a confirmacao", async () => {
    setup();
    await digitar("100.01");
    expect(screen.getByText(new RegExp(`máximo: ${brl(100).replace("$", "\\$")}`, "i"))).toBeTruthy();
    expect((screen.getByRole("button", { name: /confirmar recebimento/i }) as HTMLButtonElement).disabled).toBe(true);

    await digitar("0");
    expect((screen.getByRole("button", { name: /confirmar recebimento/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("nao existe mais uma acao separada de 'recebimento parcial'", () => {
    setup();
    expect(screen.queryByRole("button", { name: /^registrar entrada$/i })).toBeNull();
  });

  it("em contas a pagar usa os rotulos de pagamento", () => {
    setup({ tipo: "pagar" });
    expect(screen.getByLabelText(/valor pago/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /confirmar pagamento/i })).toBeTruthy();
  });

  it("sem saldo (ex.: desconto de 100%) so confirma a baixa, sem valor", async () => {
    const { onConfirm } = setup({ saldoRestante: 0 });

    expect(screen.queryByLabelText(/valor recebido/i)).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: /confirmar recebimento/i }));
    expect(onConfirm).toHaveBeenCalledWith({ metodo: "pix", valor: undefined, data_pagamento: undefined });
  });
});

describe("EstornarDialog", () => {
  it("exige motivo e envia o texto sem espacos nas pontas", async () => {
    const onConfirm = vi.fn();
    renderWithProviders(<EstornarDialog open onClose={() => {}} onConfirm={onConfirm} valorPago={80} tipo="receber" />);
    const botao = () => screen.getByRole("button", { name: /^estornar$/i }) as HTMLButtonElement;
    const user = userEvent.setup();

    expect(botao().disabled).toBe(true);
    await user.type(screen.getByLabelText(/motivo do estorno/i), "  ab ");
    expect(botao().disabled).toBe(true); // menos de 3 caracteres uteis

    await user.type(screen.getByLabelText(/motivo do estorno/i), "c duplicado");
    expect(botao().disabled).toBe(false);
    await user.click(botao());

    expect(onConfirm).toHaveBeenCalledWith({ motivo: "ab c duplicado" });
  });

  it("explica que o titulo volta para pendente e o historico eh mantido", () => {
    renderWithProviders(<EstornarDialog open onClose={() => {}} onConfirm={() => {}} valorPago={80} tipo="receber" />);
    expect(screen.getByText(/volta para pendente/i)).toBeTruthy();
    expect(screen.getByText(/histórico/i)).toBeTruthy();
  });
});

describe("MovimentosDialog", () => {
  beforeEach(() => vi.mocked(api.get).mockReset());

  it("lista pagamentos e estornos com quem fez e o motivo", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { id: 1, tipo: "pagamento", valor: "60", metodo: "pix", created_at: "2026-05-01T10:00:00Z", usuario: { id: 1, nome: "Ana" } },
        { id: 2, tipo: "estorno", valor: "60", metodo: "pix", motivo: "Cobrança em duplicidade", created_at: "2026-05-02T10:00:00Z", usuario: { id: 2, nome: "Bruno" } },
      ],
    });
    renderWithProviders(<MovimentosDialog open onClose={() => {}} contaId={7} tipo="receber" />);

    await waitFor(() => expect(screen.getByText(/^Estorno ·/)).toBeTruthy());
    expect(api.get).toHaveBeenCalledWith("/pagamentos/7/movimentos");
    expect(screen.getByText(/^Recebimento ·/)).toBeTruthy();
    expect(screen.getByText(/por Ana/)).toBeTruthy();
    expect(screen.getByText(/Motivo: Cobrança em duplicidade/)).toBeTruthy();
  });

  it("mostra estado vazio e erro da API", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] });
    const { unmount } = renderWithProviders(<MovimentosDialog open onClose={() => {}} contaId={1} tipo="pagar" />);
    await waitFor(() => expect(screen.getByText(/nenhuma movimentação/i)).toBeTruthy());
    unmount();

    vi.mocked(api.get).mockRejectedValueOnce({ response: { data: { message: "Pagamento não encontrado." } } });
    renderWithProviders(<MovimentosDialog open onClose={() => {}} contaId={2} tipo="pagar" />);
    await waitFor(() => expect(screen.getByText("Pagamento não encontrado.")).toBeTruthy());
  });
});

describe("DetalhesDialog", () => {
  const conta: Conta = {
    id: 7,
    tipo: "receber",
    status: "parcial",
    valor: 300,
    valor_original: 300,
    desconto: 0,
    valor_pago: 150,
    data_vencimento: "2026-11-01T00:00:00.000Z",
    data_pagamento: "2026-10-20T15:00:00.000Z",
    vezes_renegociado: 0,
    metodo: "transferencia",
    descricao: "Entrada do orçamento aprovado",
    categoria: "Serviços",
    cliente: { id: 1, nome: "Ana Beatriz Costa" },
  };

  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { id: 1, tipo: "pagamento", valor: "150", metodo: "transferencia", motivo: null, created_at: "2026-10-20T15:00:00.000Z", usuario: { id: 1, nome: "Lucas" } },
        { id: 2, tipo: "estorno", valor: "50", metodo: null, motivo: "Valor lançado errado", created_at: "2026-10-21T15:00:00.000Z", usuario: { id: 1, nome: "Lucas" } },
      ],
    });
  });

  const aba = (nome: string) => userEvent.setup().click(screen.getByRole("tab", { name: nome }));

  it("organiza os detalhes em abas e começa em Dados principais", async () => {
    renderWithProviders(<DetalhesDialog open onClose={() => {}} conta={conta} tipo="receber" />);

    expect(screen.getByText("Detalhes do recebimento")).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Dados principais", "Valores", "Recebimento", "Histórico"]);
    expect(screen.getByRole("tab", { name: "Dados principais" })).toHaveAttribute("aria-selected", "true");

    expect(screen.getByText("Data de vencimento")).toBeInTheDocument();
    expect(screen.getByText("01/11/2026")).toBeInTheDocument();
    expect(screen.getByText("Parcial")).toBeInTheDocument();
    expect(screen.getByText("Ana Beatriz Costa")).toBeInTheDocument();
    expect(screen.getByText("Entrada do orçamento aprovado")).toBeInTheDocument();
    // o resto fica nas outras abas
    expect(screen.queryByText("Valor original")).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("aba Valores mostra original, recebido e saldo", async () => {
    renderWithProviders(<DetalhesDialog open onClose={() => {}} conta={conta} tipo="receber" />);
    await aba("Valores");

    const valorDe = (rotulo: string) => screen.getByText(rotulo).nextElementSibling?.textContent?.replace(/\s/g, " ");
    expect(valorDe("Valor original")).toBe(brl(300));
    expect(valorDe("Recebido")).toBe(brl(150));
    expect(valorDe("Saldo restante")).toBe(brl(150));
  });

  it("aba Recebimento mostra data de recebimento e método", async () => {
    renderWithProviders(<DetalhesDialog open onClose={() => {}} conta={conta} tipo="receber" />);
    await aba("Recebimento");

    expect(screen.getByText("Data de recebimento")).toBeInTheDocument();
    expect(screen.getByText("20/10/2026")).toBeInTheDocument();
    expect(screen.getByText("Método de recebimento")).toBeInTheDocument();
    expect(screen.getByText("Transferência")).toBeInTheDocument();
  });

  it("aba Histórico carrega os recebimentos e estornos só quando aberta", async () => {
    renderWithProviders(<DetalhesDialog open onClose={() => {}} conta={conta} tipo="receber" />);
    await aba("Histórico");

    expect(screen.getByText("Histórico de recebimentos")).toBeInTheDocument();
    expect(await screen.findByText((t) => t.replace(/\s/g, " ") === `Recebimento · +${brl(150)}`)).toBeInTheDocument();
    expect(await screen.findByText(/Estorno/)).toBeInTheDocument();
    expect(screen.getByText("Motivo: Valor lançado errado")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/pagamentos/7/movimentos");
  });

  it("título sem recebimento mostra traços nas datas e o histórico vazio", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    renderWithProviders(
      <DetalhesDialog
        open
        onClose={() => {}}
        tipo="receber"
        conta={{ ...conta, status: "pendente", valor_pago: 0, data_pagamento: undefined, metodo: undefined }}
      />
    );

    await aba("Recebimento");
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    await aba("Histórico");
    expect(await screen.findByText(/Nenhuma movimentação registrada/)).toBeInTheDocument();
  });

  it("não busca o histórico enquanto fechado", () => {
    renderWithProviders(<DetalhesDialog open={false} onClose={() => {}} conta={conta} tipo="receber" />);
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe("formatarData", () => {
  it("meia-noite UTC é data de calendário (não volta um dia no fuso do Brasil); instante segue o fuso local", () => {
    expect(formatarData("2026-11-01T00:00:00.000Z")).toBe("01/11/2026");
    expect(formatarData("2026-10-20T15:00:00.000Z")).toBe("20/10/2026");
    expect(formatarData(null)).toBe("—");
    expect(formatarData("lixo")).toBe("—");
  });
});
