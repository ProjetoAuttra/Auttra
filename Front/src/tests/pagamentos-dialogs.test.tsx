import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import api from "../api/api";
import { DetalhesDialog, EstornarDialog, MovimentosDialog, ReceberDialog } from "../modules/pagamentos/dialogs";
import { ReceberTituloDialog, RenegociarTituloDialog } from "../modules/pagamentos/dialogs/TituloDialogs";
import { formatarData, hojeInput, type Conta } from "../modules/pagamentos/api/api";

// O calendário próprio é testado à parte (campo-data.test.tsx); aqui um input simples mantém os testes dos formulários diretos.
vi.mock("../components/common/CampoData", () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

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

  it("valor menor que o saldo avisa que o resto vira um novo título e envia o valor", async () => {
    const { onConfirm } = setup();
    const user = await digitar("40");

    const aviso = screen.getByText(/será lançado como um novo título pendente/i);
    expect(aviso.textContent?.replace(/\s/g, " ")).toContain(brl(60));
    expect(screen.getByLabelText(/data do recebimento/i)).toBeTruthy();

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

  it("título pendente mostra o método como previsto, não como recebimento", async () => {
    renderWithProviders(
      <DetalhesDialog open onClose={() => {}} tipo="receber" conta={{ ...conta, status: "pendente", valor_pago: 0, data_pagamento: undefined, metodo: "boleto" }} />
    );
    await aba("Recebimento");

    expect(screen.getByText("Método previsto")).toBeInTheDocument();
    expect(screen.queryByText("Método de recebimento")).toBeNull();
    expect(screen.getByText("Boleto")).toBeInTheDocument();
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

describe("ReceberTituloDialog (receber + desconto na mesma tela)", () => {
  const conta: Conta = {
    id: 9,
    tipo: "receber",
    status: "pendente",
    valor: 300,
    valor_original: 300,
    desconto: 0,
    valor_pago: 0,
    data_vencimento: "2026-11-01T00:00:00.000Z",
    vezes_renegociado: 0,
    descricao: "Entrada do orçamento",
    cliente: { id: 1, nome: "Ana Beatriz Costa" },
  };

  const setup = (c: Conta = conta) => {
    const onConfirm = vi.fn();
    renderWithProviders(<ReceberTituloDialog open onClose={() => {}} conta={c} tipo="receber" onConfirm={onConfirm} />);
    return { onConfirm, user: userEvent.setup() };
  };
  const valor = () => screen.getByLabelText(/valor recebido/i) as HTMLInputElement;
  const norm = (t?: string | null) => t?.replace(/\s/g, " ");
  const ligarDesconto = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("switch", { name: /aplicar desconto/i }));
  const escolherMetodo = async (user: ReturnType<typeof userEvent.setup>, nome = "PIX") => {
    await user.click(screen.getByRole("combobox", { name: /método/i }));
    await user.click(await screen.findByRole("option", { name: nome }));
  };

  it("é uma tela só: valor, método, data e desconto juntos, com o resumo ao lado e sem abas", () => {
    setup();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getByLabelText(/valor recebido/i)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /aplicar desconto/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/método/i)).toBeInTheDocument();
    expect(screen.getByText("Ana Beatriz Costa")).toBeInTheDocument();
    expect(norm(screen.getByText("Saldo a receber").nextElementSibling?.textContent)).toBe(brl(300));
  });

  it("o desconto fica escondido até ligar o interruptor, e desligar de novo descarta o desconto digitado", async () => {
    const { user } = setup();
    expect(screen.queryByLabelText(/valor do desconto/i)).toBeNull();
    expect(screen.queryByLabelText(/motivo do desconto/i)).toBeNull();

    await ligarDesconto(user);
    await user.type(await screen.findByLabelText(/valor do desconto/i), "50");
    expect(parseFloat(valor().value)).toBe(250);

    await ligarDesconto(user); // desliga
    await waitFor(() => expect(screen.queryByLabelText(/valor do desconto/i)).toBeNull());
    expect(parseFloat(valor().value)).toBe(300);
    expect(norm(screen.getByText("Saldo a receber").nextElementSibling?.textContent)).toBe(brl(300));
  });

  it("ligar o desconto sem informar o valor bloqueia a confirmação", async () => {
    const { user } = setup();
    await escolherMetodo(user);
    await ligarDesconto(user);
    expect((screen.getByRole("button", { name: /confirmar recebimento/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("data vem preenchida com hoje e o método não vem pré-selecionado (confirmar fica bloqueado até escolher)", async () => {
    const { user } = setup();
    expect((screen.getByLabelText(/data do recebimento/i) as HTMLInputElement).value).toBe(hojeInput());
    const confirmar = () => screen.getByRole("button", { name: /confirmar recebimento/i }) as HTMLButtonElement;
    expect(confirmar().disabled).toBe(true);
    await escolherMetodo(user, "Boleto");
    expect(confirmar().disabled).toBe(false);
  });

  it("rodapé: Cancelar à esquerda e o botão de confirmar à direita, juntos no fim do modal", () => {
    setup();
    const botoes = within(screen.getByRole("dialog")).getAllByRole("button").map((b) => b.textContent);
    const iCancelar = botoes.indexOf("Cancelar");
    const iConfirmar = botoes.findIndex((t) => /confirmar recebimento/i.test(t ?? ""));
    expect(iCancelar).toBeGreaterThan(-1);
    expect(iConfirmar).toBe(iCancelar + 1);
  });

  it("sem desconto, confirma o saldo inteiro e não envia desconto", async () => {
    const { onConfirm, user } = setup();
    expect(valor().value).toBe("300.00");
    await escolherMetodo(user);
    await user.click(screen.getByRole("button", { name: /confirmar recebimento/i }));
    expect(onConfirm).toHaveBeenCalledWith({ metodo: "pix", valor: 300, data_pagamento: hojeInput() });
  });

  it("o desconto reduz o valor sugerido e o saldo do resumo, e viaja junto com o recebimento", async () => {
    const { onConfirm, user } = setup();
    await ligarDesconto(user);
    await user.type(screen.getByLabelText(/valor do desconto/i), "50");

    expect(parseFloat(valor().value)).toBe(250);
    expect(norm(screen.getByText("Saldo a receber").nextElementSibling?.textContent)).toBe(brl(250));
    expect((screen.getByRole("button", { name: /confirmar recebimento/i }) as HTMLButtonElement).disabled).toBe(true); // falta o motivo

    await user.type(screen.getByLabelText(/motivo do desconto/i), "Cliente antigo");
    await escolherMetodo(user);
    await user.click(screen.getByRole("button", { name: /confirmar recebimento/i }));
    expect(onConfirm).toHaveBeenCalledWith({ metodo: "pix", valor: 250, data_pagamento: hojeInput(), desconto: 50, motivo_desconto: "Cliente antigo" });
  });

  it("a multa soma ao saldo, não pede motivo e viaja junto com o recebimento", async () => {
    const { onConfirm, user } = setup();
    expect(screen.queryByLabelText(/valor da multa/i)).toBeNull();

    await user.click(screen.getByRole("switch", { name: /aplicar multa/i }));
    expect((screen.getByRole("button", { name: /confirmar recebimento/i }) as HTMLButtonElement).disabled).toBe(true); // ligou sem valor
    await user.type(screen.getByLabelText(/valor da multa/i), "20");

    expect(parseFloat(valor().value)).toBe(320);
    expect(norm(screen.getByText("Multa").nextElementSibling?.textContent)).toBe(`+ ${brl(20)}`);
    expect(norm(screen.getByText("Saldo a receber").nextElementSibling?.textContent)).toBe(brl(320));

    await escolherMetodo(user);
    await user.click(screen.getByRole("button", { name: /confirmar recebimento/i }));
    expect(onConfirm).toHaveBeenCalledWith({ metodo: "pix", valor: 320, data_pagamento: hojeInput(), multa: 20 });
  });

  it("multa e desconto juntos: saldo = original - desconto + multa", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("switch", { name: /aplicar desconto/i }));
    await user.type(screen.getByLabelText(/valor do desconto/i), "50");
    await user.click(screen.getByRole("switch", { name: /aplicar multa/i }));
    await user.type(screen.getByLabelText(/valor da multa/i), "30");
    expect(norm(screen.getByText("Saldo a receber").nextElementSibling?.textContent)).toBe(brl(280));
  });

  it("desconto e multa aceitam percentual do valor original e viajam em reais", async () => {
    const { onConfirm, user } = setup(); // original 300
    const emPorcentagem = (grupo: RegExp) => user.click(within(screen.getByRole("group", { name: grupo })).getByRole("button", { name: /porcentagem/i }));

    await ligarDesconto(user);
    await emPorcentagem(/unidade do desconto/i);
    await user.type(screen.getByLabelText(/valor do desconto/i), "10");
    await user.type(screen.getByLabelText(/motivo do desconto/i), "Cliente antigo");
    expect(norm(screen.getByText(/^= R\$/).textContent)).toBe(`= ${brl(30)}`);

    await user.click(screen.getByRole("switch", { name: /aplicar multa/i }));
    await emPorcentagem(/unidade da multa/i);
    await user.type(screen.getByLabelText(/valor da multa/i), "5");

    expect(norm(screen.getByText("Saldo a receber").nextElementSibling?.textContent)).toBe(brl(285)); // 300 - 30 + 15
    await escolherMetodo(user);
    await user.click(screen.getByRole("button", { name: /confirmar recebimento/i }));
    expect(onConfirm).toHaveBeenCalledWith({ metodo: "pix", valor: 285, data_pagamento: hojeInput(), desconto: 30, motivo_desconto: "Cliente antigo", multa: 15 });
  });

  it("desconto acima de 100% é bloqueado", async () => {
    const { user } = setup();
    await ligarDesconto(user);
    await user.click(within(screen.getByRole("group", { name: /unidade do desconto/i })).getByRole("button", { name: /porcentagem/i }));
    await user.type(screen.getByLabelText(/valor do desconto/i), "101");
    expect(screen.getByText("Máximo: 100%")).toBeInTheDocument();
  });

  it("valor digitado não é sobrescrito pelo desconto; parcial avisa o saldo", async () => {
    const { onConfirm, user } = setup();
    await user.clear(valor());
    await user.type(valor(), "100");
    await ligarDesconto(user);
    await user.type(screen.getByLabelText(/valor do desconto/i), "20");
    await user.type(screen.getByLabelText(/motivo do desconto/i), "x");

    expect(valor().value).toBe("100");
    expect(norm(screen.getByText(/será lançado como um novo título pendente/i).textContent)).toContain(brl(180)); // 300 - 20 - 100
    await escolherMetodo(user);
    await user.click(screen.getByRole("button", { name: /registrar recebimento parcial/i }));
    expect(onConfirm).toHaveBeenCalledWith({ metodo: "pix", valor: 100, data_pagamento: hojeInput(), desconto: 20, motivo_desconto: "x" });
  });

  it("desconto maior que o valor original é bloqueado", async () => {
    const { user } = setup();
    await ligarDesconto(user);
    await user.type(screen.getByLabelText(/valor do desconto/i), "301");
    expect(screen.getByText(/máximo/i)).toBeInTheDocument();
    expect((screen.getByRole("button", { name: /confirmar recebimento/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("desconto de 100% esconde o valor e só confirma a baixa", async () => {
    const { onConfirm, user } = setup();
    await ligarDesconto(user);
    await user.type(screen.getByLabelText(/valor do desconto/i), "300");
    await user.type(screen.getByLabelText(/motivo do desconto/i), "Cortesia");

    expect(screen.queryByLabelText(/valor recebido/i)).toBeNull();
    await escolherMetodo(user);
    await user.click(screen.getByRole("button", { name: /confirmar recebimento/i }));
    expect(onConfirm).toHaveBeenCalledWith({ metodo: "pix", valor: undefined, data_pagamento: hojeInput(), desconto: 300, motivo_desconto: "Cortesia" });
  });

  it("título com desconto abre com o interruptor ligado; desligar remove o desconto", async () => {
    const { onConfirm, user } = setup({ ...conta, desconto: 40, motivo_desconto: "Fidelidade" });
    expect(screen.getByRole("switch", { name: /aplicar desconto/i })).toBeChecked();
    await ligarDesconto(user); // desliga
    await escolherMetodo(user);
    await user.click(screen.getByRole("button", { name: /confirmar recebimento/i }));
    expect(onConfirm).toHaveBeenCalledWith({ metodo: "pix", valor: 300, data_pagamento: hojeInput(), desconto: 0 });
  });

  it("título que já tem desconto abre com ele preenchido e só reenvia se mudar", async () => {
    const { onConfirm, user } = setup({ ...conta, desconto: 40, motivo_desconto: "Fidelidade" });
    expect((screen.getByLabelText(/valor do desconto/i) as HTMLInputElement).value).toBe("40.00");
    expect(valor().value).toBe("260.00");
    await escolherMetodo(user);
    await user.click(screen.getByRole("button", { name: /confirmar recebimento/i }));
    expect(onConfirm).toHaveBeenCalledWith({ metodo: "pix", valor: 260, data_pagamento: hojeInput() });
  });
});

describe("RenegociarTituloDialog (parcelar)", () => {
  const conta: Conta = {
    id: 9,
    tipo: "receber",
    status: "pendente",
    valor: 300,
    valor_original: 300,
    desconto: 0,
    valor_pago: 0,
    data_vencimento: "2026-11-01T00:00:00.000Z",
    vezes_renegociado: 0,
    descricao: "Entrada do orçamento",
    cliente: { id: 1, nome: "Ana Beatriz Costa" },
  };

  it("parcela o saldo: mostra o valor por parcela e envia o parcelamento", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<RenegociarTituloDialog open onClose={() => {}} conta={conta} tipo="receber" onConfirm={onConfirm} />);

    expect(screen.getByText("Renegociar")).toBeInTheDocument();
    expect(screen.getByText(/por parcela/i).textContent?.replace(/\s/g, " ")).toContain(brl(150));
    const botao = screen.getByRole("button", { name: /confirmar renegociação/i }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true); // falta a data da 1ª parcela

    await user.type(screen.getByLabelText(/data da 1ª parcela/i), "2026-12-01");
    await user.clear(screen.getByLabelText(/número de parcelas/i));
    await user.type(screen.getByLabelText(/número de parcelas/i), "3");
    expect(screen.getByText(/por parcela/i).textContent?.replace(/\s/g, " ")).toContain(brl(100));
    await user.click(botao);

    expect(onConfirm).toHaveBeenCalledWith({ total_parcelas: 3, data_primeira_parcela: "2026-12-01", metodo: undefined });
  });

  it("rejeita menos de 2 ou mais de 60 parcelas", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RenegociarTituloDialog open onClose={() => {}} conta={conta} tipo="receber" onConfirm={() => {}} />);
    await user.type(screen.getByLabelText(/data da 1ª parcela/i), "2026-12-01");
    const campo = screen.getByLabelText(/número de parcelas/i);
    for (const ruim of ["1", "61"]) {
      await user.clear(campo);
      await user.type(campo, ruim);
      expect((screen.getByRole("button", { name: /confirmar renegociação/i }) as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
