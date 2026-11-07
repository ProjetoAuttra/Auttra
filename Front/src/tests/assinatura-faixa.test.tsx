import type { ReactElement } from "react";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import FaixaAssinatura from "../components/layout/FaixaAssinatura";
import ItemPremium from "../components/layout/ItemPremium";
import Assinatura from "../modules/assinatura/pages/Assinatura";
import { CHAVE_FAIXA_FECHADA, faixaDaAssinatura, hojeSP, linkAssinar, type Assinatura as DadosAssinatura } from "../modules/assinatura/assinatura";

const estado = vi.hoisted(() => ({ assinatura: null as DadosAssinatura | null }));
vi.mock("../context/AssinaturaContext", () => ({ useAssinatura: () => ({ assinatura: estado.assinatura, recarregar: vi.fn() }) }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { oficinaId: 7, oficina_nome: "Auto Center Ana" } }) }));

const base: DadosAssinatura = {
  situacao: "teste", status: "teste", somenteLeitura: false, plano: null,
  testeTerminaEm: "2026-11-13T15:00:00.000Z", ativadaEm: null, diasRestantes: 7,
};

function Onde() {
  return <div data-testid="onde">{useLocation().pathname}</div>;
}

const montar = (ui: ReactElement) =>
  renderWithProviders(
    <MemoryRouter initialEntries={["/"]}>
      {ui}
      <Routes>
        <Route path="*" element={<Onde />} />
      </Routes>
    </MemoryRouter>
  );

describe("faixaDaAssinatura", () => {
  it("teste: dias que faltam; vencido: só consulta; suspensa: falar com a gente; ativa: sem faixa", () => {
    expect(faixaDaAssinatura({ ...base, diasRestantes: 7 })).toMatchObject({ tom: "info", titulo: "Faltam 7 dias do seu teste grátis:" });
    expect(faixaDaAssinatura({ ...base, diasRestantes: 1 })?.titulo).toBe("Último dia do seu teste grátis:");
    expect(faixaDaAssinatura({ ...base, situacao: "teste_vencido", somenteLeitura: true })).toMatchObject({ tom: "alerta", texto: expect.stringContaining("Adquira o Premium") });
    expect(faixaDaAssinatura({ ...base, situacao: "suspensa", status: "suspensa" })).toMatchObject({ tom: "erro", titulo: "Assinatura suspensa:" });
    expect(faixaDaAssinatura({ ...base, situacao: "ativa", status: "ativa" })).toBeNull();
    expect(faixaDaAssinatura(null)).toBeNull();
  });

  it("o link de assinar leva o plano e a oficina para o WhatsApp", () => {
    const url = new URL(linkAssinar("semestral", { nome: "Auto Center Ana", id: 7 }));
    expect(url.hostname).toBe("wa.me");
    expect(url.searchParams.get("text")).toBe("Olá! Quero assinar o plano semestral do Auttra.\nOficina: Auto Center Ana (código 7)");
  });
});

// Vários cliques e remontagens: com a suíte inteira rodando, passa dos 5s padrão.
describe("faixa do topo", { timeout: 30_000 }, () => {
  beforeEach(() => {
    localStorage.clear();
    estado.assinatura = { ...base };
  });

  it("mostra os dias do teste, leva aos planos e, fechada no X, só volta no dia seguinte ou num novo login", async () => {
    const user = userEvent.setup();
    const { unmount } = montar(<FaixaAssinatura />);
    expect(screen.getByText("Faltam 7 dias do seu teste grátis:")).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue("--faixa-assinatura-altura")).toMatch(/px$/);

    await user.click(screen.getByRole("button", { name: "Adquirir Premium" }));
    expect(screen.getByTestId("onde")).toHaveTextContent("/assinatura");

    await user.click(screen.getByRole("button", { name: "Fechar aviso" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue("--faixa-assinatura-altura")).toBe("0px");
    expect(localStorage.getItem(CHAVE_FAIXA_FECHADA)).toBe(hojeSP());
    unmount();

    // Mesmo dia: recarregar a página mantém fechada.
    const mesmoDia = montar(<FaixaAssinatura />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    mesmoDia.unmount();

    // Fechada ontem: volta hoje.
    localStorage.setItem(CHAVE_FAIXA_FECHADA, "2000-01-01");
    const outroDia = montar(<FaixaAssinatura />);
    expect(screen.getByText("Faltam 7 dias do seu teste grátis:")).toBeInTheDocument();
    outroDia.unmount();

    // Login novo apaga a marca: volta mesmo que tenha fechado hoje.
    localStorage.setItem(CHAVE_FAIXA_FECHADA, hojeSP());
    localStorage.removeItem(CHAVE_FAIXA_FECHADA);
    montar(<FaixaAssinatura />);
    expect(screen.getByText("Faltam 7 dias do seu teste grátis:")).toBeInTheDocument();
  });

  it("aba aberta de um dia para o outro: ao voltar para a aba, a faixa reaparece", async () => {
    const user = userEvent.setup();
    montar(<FaixaAssinatura />);
    await user.click(screen.getByRole("button", { name: "Fechar aviso" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    localStorage.setItem(CHAVE_FAIXA_FECHADA, "2000-01-01"); // virou o dia
    act(() => { window.dispatchEvent(new Event("focus")); });
    expect(screen.getByText("Faltam 7 dias do seu teste grátis:")).toBeInTheDocument();
  });

  it("conta suspensa: aviso vermelho que também leva à compra do Premium e fecha no X", async () => {
    const user = userEvent.setup();
    estado.assinatura = { ...base, situacao: "suspensa", status: "suspensa", somenteLeitura: true, diasRestantes: null };
    montar(<FaixaAssinatura />);
    expect(screen.getByText("Assinatura suspensa:")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Adquirir Premium" }));
    expect(screen.getByTestId("onde")).toHaveTextContent("/assinatura");
    await user.click(screen.getByRole("button", { name: "Fechar aviso" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("assinatura ativa não mostra faixa", () => {
    estado.assinatura = { ...base, situacao: "ativa", status: "ativa", diasRestantes: null };
    montar(<FaixaAssinatura />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("Premium no menu e tela de planos", () => {
  it("aparece no teste com os dias que faltam e some quando assina", async () => {
    const user = userEvent.setup();
    estado.assinatura = { ...base, diasRestantes: 3 };
    const { unmount } = montar(<ItemPremium />);
    expect(screen.getByText("Faltam 3 dias de teste")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Premium/ }));
    expect(screen.getByTestId("onde")).toHaveTextContent("/assinatura");
    unmount();

    estado.assinatura = { ...base, situacao: "ativa", status: "ativa" };
    montar(<ItemPremium />);
    expect(screen.queryByText("Premium")).not.toBeInTheDocument();
  });

  it("tela de planos: dois planos com preço e link de WhatsApp, também para conta suspensa", () => {
    estado.assinatura = { ...base, situacao: "suspensa", status: "suspensa", somenteLeitura: true };
    montar(<Assinatura />);
    expect(screen.getByText("42,90")).toBeInTheDocument();
    expect(screen.getByText("54,90")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Assinar o semestral" }).getAttribute("href")).toContain("wa.me/5548991268901");
  });
});
