import type { ReactElement } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import FaixaAssinatura from "../components/layout/FaixaAssinatura";
import ItemPremium from "../components/layout/ItemPremium";
import Assinatura from "../modules/assinatura/pages/Assinatura";
import { faixaDaAssinatura, linkAssinar, type Assinatura as DadosAssinatura } from "../modules/assinatura/assinatura";

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
  it("teste: dias que faltam e pode fechar; vencido e suspensa: não fecha; ativa: sem faixa", () => {
    expect(faixaDaAssinatura({ ...base, diasRestantes: 7 })).toMatchObject({ tom: "info", podeFechar: true, texto: expect.stringContaining("Faltam 7 dias") });
    expect(faixaDaAssinatura({ ...base, diasRestantes: 1 })?.texto).toContain("Último dia");
    expect(faixaDaAssinatura({ ...base, situacao: "teste_vencido", somenteLeitura: true })).toMatchObject({ tom: "alerta", podeFechar: false, acao: "planos" });
    expect(faixaDaAssinatura({ ...base, situacao: "suspensa", status: "suspensa" })).toMatchObject({ podeFechar: false, acao: "falar" });
    expect(faixaDaAssinatura({ ...base, situacao: "ativa", status: "ativa" })).toBeNull();
    expect(faixaDaAssinatura(null)).toBeNull();
  });

  it("o link de assinar leva o plano e a oficina para o WhatsApp", () => {
    const url = new URL(linkAssinar("semestral", { nome: "Auto Center Ana", id: 7 }));
    expect(url.hostname).toBe("wa.me");
    expect(url.searchParams.get("text")).toBe("Olá! Quero assinar o plano semestral do Auttra.\nOficina: Auto Center Ana (código 7)");
  });
});

describe("faixa do topo", () => {
  beforeEach(() => {
    localStorage.clear();
    estado.assinatura = { ...base };
  });

  it("mostra os dias do teste, leva aos planos e, fechada, só volta no dia seguinte", async () => {
    const user = userEvent.setup();
    const { unmount } = montar(<FaixaAssinatura />);
    expect(screen.getByText(/Faltam 7 dias do seu teste grátis/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver planos" }));
    expect(screen.getByTestId("onde")).toHaveTextContent("/assinatura");

    await user.click(screen.getByRole("button", { name: "Fechar aviso" }));
    expect(screen.queryByText(/Faltam 7 dias/)).not.toBeInTheDocument();
    unmount();

    montar(<FaixaAssinatura />);
    expect(screen.queryByText(/Faltam 7 dias/)).not.toBeInTheDocument();

    // Fechada "ontem": aparece de novo.
    localStorage.setItem("auttra:faixa-teste-fechada:7", "2000-01-01");
    montar(<FaixaAssinatura />);
    expect(screen.getByText(/Faltam 7 dias/)).toBeInTheDocument();
  });

  it("conta só leitura não deixa fechar, mesmo se foi fechada no teste", () => {
    localStorage.setItem("auttra:faixa-teste-fechada:7", new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }));
    estado.assinatura = { ...base, situacao: "teste_vencido", somenteLeitura: true, diasRestantes: 0 };
    montar(<FaixaAssinatura />);
    expect(screen.getByText(/Seu teste grátis terminou/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fechar aviso" })).not.toBeInTheDocument();
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

  it("tela de planos: dois planos com preço e link de WhatsApp", () => {
    estado.assinatura = { ...base };
    montar(<Assinatura />);
    expect(screen.getByText("42,90")).toBeInTheDocument();
    expect(screen.getByText("54,90")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Assinar o semestral" }).getAttribute("href")).toContain("wa.me/5548991268901");
  });
});
