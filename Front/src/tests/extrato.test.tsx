import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import api from "../api/api";
import ExtratoFinanceiro from "../modules/pagamentos/pages/extrato/payments";

vi.mock("../components/common/CampoData", () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock("../api/api", () => ({ default: { get: vi.fn(), defaults: { headers: { common: {} } } } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock("../context/ToastContext", () => ({ useToast: () => toast }));

const get = vi.mocked(api.get);

const parcela = {
  chave: "r1", tipo: "receber", data: "2026-12-10", valor: 95, valor_bruto: 100, valor_taxa: 5,
  descricao: "Revisão", metodo: "cartao_credito", cartao_parcelas: 3, parcela: 1, total_parcelas: 3, maquininha: "Stone", cliente: "Ana",
};
const pix = {
  chave: "p2", tipo: "receber", data: "2026-12-05", valor: 50, valor_bruto: 50, valor_taxa: 0,
  descricao: "Troca de óleo", metodo: "pix", cliente: "Bruno",
};
const tituloPago = {
  id: 7, tipo: "receber", valor_pago: 300, data_pagamento: "2026-11-10T00:00:00.000Z", descricao: "Revisão",
  metodo: "cartao_credito", cartao_parcelas: 3, cliente: { nome: "Ana" },
};

const respostas: Record<string, unknown> = {
  "/pagamentos/extrato/efetivacao": [parcela, pix],
  "/pagamentos/extrato/efetivacao/resumo": { entradas: 145, saidas: 0, saldo: 145, qtd_entradas: 2, qtd_saidas: 0, taxas_cartao: 5 },
  "/pagamentos": [tituloPago],
  "/pagamentos/extrato/resumo": { entradas: 300, saidas: 0, saldo: 300, qtd_entradas: 1, qtd_saidas: 0, taxas_cartao: 15 },
  "/pagamentos/extrato/a-cair": { total: 190, qtd: 2, proxima: "2027-01-09", ultima: "2027-02-08" },
};

beforeEach(() => {
  get.mockReset();
  get.mockImplementation(async (url: string) => {
    const data = structuredClone(respostas[url]);
    return { data, headers: { "x-total-count": String(Array.isArray(data) ? data.length : 0) } } as any;
  });
});

const abrir = () => {
  renderWithProviders(
    <MemoryRouter>
      <ExtratoFinanceiro />
    </MemoryRouter>
  );
  return userEvent.setup();
};

const chamadas = (url: string) => get.mock.calls.filter(([u]) => u === url);

describe("Extrato", () => {
  it("abre pela efetivação: cartão líquido, por parcela, com a taxa e a maquininha", async () => {
    abrir();
    expect(await screen.findByText(/parcela 1\/3/)).toBeInTheDocument();
    expect(screen.getByText(/Stone · R\$\s100,00 − R\$\s5,00 de taxa/)).toBeInTheDocument();
    expect(screen.getByText(/\+ R\$\s95,00/)).toBeInTheDocument();
    expect(screen.getByText("10/12/2026")).toBeInTheDocument();
    expect(screen.getByText("Cai em")).toBeInTheDocument();
    expect(await screen.findByText(/já sem R\$\s5,00 de taxas/)).toBeInTheDocument();
    expect(chamadas("/pagamentos")).toHaveLength(0);
  });

  it("por recebimento, mostra o título bruto no dia da venda", async () => {
    const user = abrir();
    await screen.findByText(/parcela 1\/3/);
    await user.click(screen.getByRole("button", { name: "Recebimento" }));

    expect(await screen.findByText(/\+ R\$\s300,00/)).toBeInTheDocument();
    expect(screen.getByText("10/11/2026")).toBeInTheDocument();
    expect(screen.queryByText(/parcela 1\/3/)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith("/pagamentos", expect.objectContaining({ params: expect.objectContaining({ status: "pago", ordem: "pagamento" }) }))
    );
    expect(await screen.findByText(/R\$\s15,00 de taxas de cartão/)).toBeInTheDocument();
  });

  it("o card do que vai cair leva às parcelas futuras", async () => {
    const user = abrir();
    await user.click(await screen.findByText("A cair das maquininhas"));
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        "/pagamentos/extrato/efetivacao",
        expect.objectContaining({ params: expect.objectContaining({ tipo: "receber", ate: "2027-02-08" }) })
      )
    );
    expect(screen.getByLabelText("Data final")).toHaveValue("2027-02-08");
  });
});
