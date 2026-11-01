import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import { EstornarDialog } from "../modules/pagamentos/dialogs";
import { ReceberTituloDialog } from "../modules/pagamentos/dialogs/TituloDialogs";
import type { Conta } from "../modules/pagamentos/api/api";

vi.mock("../components/common/CampoData", () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock("../api/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), defaults: { headers: { common: {} } } },
}));

/** Promise controlada pelo teste: o salvamento fica "em andamento" até chamar resolver/rejeitar. */
function pendente() {
  let resolver!: () => void;
  let rejeitar!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolver = res; rejeitar = rej; });
  return { promise, resolver, rejeitar };
}

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

describe("trava de duplo envio nos modais financeiros", () => {
  const abrirReceber = async (onConfirm: () => Promise<void>) => {
    const user = userEvent.setup();
    renderWithProviders(<ReceberTituloDialog open onClose={() => {}} conta={conta} tipo="receber" onConfirm={onConfirm} />);
    await user.click(screen.getByRole("combobox", { name: /método/i }));
    await user.click(await screen.findByRole("option", { name: "PIX" }));
    return { user, botao: () => screen.getByRole("button", { name: /confirmar recebimento/i }) as HTMLButtonElement };
  };

  it("clique duplo no Receber registra uma vez só e trava o botão enquanto salva", async () => {
    const salvamento = pendente();
    const onConfirm = vi.fn(() => salvamento.promise);
    const { user, botao } = await abrirReceber(onConfirm);

    await user.dblClick(botao());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(botao().disabled).toBe(true);
    expect(botao().querySelector(".MuiCircularProgress-root")).not.toBeNull();

    salvamento.resolver();
    await waitFor(() => expect(botao().disabled).toBe(false));
  });

  it("se o salvamento falha, o modal continua aberto e o botão volta a funcionar", async () => {
    const salvamento = pendente();
    const onConfirm = vi.fn(() => salvamento.promise);
    const { user, botao } = await abrirReceber(onConfirm);

    await user.click(botao());
    salvamento.rejeitar(new Error("falhou"));

    await waitFor(() => expect(botao().disabled).toBe(false));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/valor recebido/i)).toHaveValue("300,00");

    onConfirm.mockResolvedValueOnce(undefined);
    await user.click(botao());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("Estornar: clique duplo estorna uma vez só", async () => {
    const salvamento = pendente();
    const onConfirm = vi.fn(() => salvamento.promise);
    const user = userEvent.setup();
    renderWithProviders(<EstornarDialog open onClose={() => {}} onConfirm={onConfirm} valorPago={80} tipo="receber" />);
    await user.type(screen.getByLabelText(/motivo do estorno/i), "Cobrança duplicada");
    const botao = screen.getByRole("button", { name: /^estornar$/i }) as HTMLButtonElement;

    await user.dblClick(botao);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(botao.disabled).toBe(true);
    salvamento.resolver();
    await waitFor(() => expect(botao.disabled).toBe(false));
  });
});

describe("campo de valor com máscara de moeda", () => {
  it("aceita só dígitos (entram pelos centavos) e envia o número em reais", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<ReceberTituloDialog open onClose={() => {}} conta={conta} tipo="receber" onConfirm={onConfirm} />);
    const campo = screen.getByLabelText(/valor recebido/i) as HTMLInputElement;

    expect(campo).not.toHaveAttribute("type", "number");
    expect(campo).toHaveAttribute("inputmode", "decimal");
    await user.clear(campo);
    await user.type(campo, "1234,5");
    expect(campo.value).toBe("123,45");

    await user.click(screen.getByRole("combobox", { name: /método/i }));
    await user.click(await screen.findByRole("option", { name: "PIX" }));
    await user.click(screen.getByRole("button", { name: /registrar recebimento parcial/i }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ valor: 123.45 }));
  });

  it("desconto em % aceita vírgula", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReceberTituloDialog open onClose={() => {}} conta={conta} tipo="receber" onConfirm={vi.fn()} />);
    await user.click(screen.getByRole("switch", { name: /aplicar desconto/i }));
    await user.click(screen.getByRole("button", { name: /em porcentagem/i }));
    const campo = screen.getByLabelText(/valor do desconto/i) as HTMLInputElement;
    await user.type(campo, "2,5");

    expect(campo.value).toBe("2,5");
    expect(screen.getByText(/^= R\$/).textContent?.replace(/\s/g, " ")).toBe("= R$ 7,50"); // 2,5% de 300
  });
});
