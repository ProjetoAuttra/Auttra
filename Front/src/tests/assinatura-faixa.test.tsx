import type { ReactElement } from "react";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import FaixaAssinatura from "../components/layout/FaixaAssinatura";
import ItemPremium from "../components/layout/ItemPremium";
import PlanosDialog from "../modules/assinatura/components/PlanosDialog";
import { CHAVE_FAIXA_FECHADA, faixaDaAssinatura, hojeSP, linkAssinar, textoDiasRestantes, type Assinatura as DadosAssinatura } from "../modules/assinatura/assinatura";

const estado = vi.hoisted(() => ({ assinatura: null as DadosAssinatura | null, planosAbertos: false, abrirPlanos: vi.fn(), fecharPlanos: vi.fn() }));
vi.mock("../context/AssinaturaContext", () => ({
  useAssinatura: () => ({
    assinatura: estado.assinatura,
    recarregar: vi.fn(),
    planosAbertos: estado.planosAbertos,
    abrirPlanos: estado.abrirPlanos,
    fecharPlanos: estado.fecharPlanos,
  }),
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { oficinaId: 7, oficina_nome: "Auto Center Ana" } }) }));

const base: DadosAssinatura = {
  situacao: "teste", status: "teste", somenteLeitura: false, plano: null,
  testeTerminaEm: "2026-11-13T15:00:00.000Z", ativadaEm: null, diasRestantes: 7,
};

const montar = (ui: ReactElement) => renderWithProviders(ui);

beforeEach(() => {
  estado.planosAbertos = false;
  estado.abrirPlanos.mockReset();
  estado.fecharPlanos.mockReset();
});

describe("faixaDaAssinatura", () => {
  it("teste: dias que faltam; vencido e suspensa: só consulta; ativa: sem faixa", () => {
    expect(faixaDaAssinatura({ ...base, diasRestantes: 7 })).toMatchObject({ tom: "info", titulo: "Faltam 7 dias do seu teste grátis:" });
    expect(faixaDaAssinatura({ ...base, diasRestantes: 1 })?.titulo).toBe("Falta 1 dia do seu teste grátis:");
    // 0 = hoje é o último dia (o teste vai até 23:59).
    expect(faixaDaAssinatura({ ...base, diasRestantes: 0 })?.titulo).toBe("Último dia do seu teste grátis:");
    expect(textoDiasRestantes(2)).toBe("Faltam 2 dias do seu teste grátis");
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
    expect(estado.abrirPlanos).toHaveBeenCalledTimes(1);

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
    expect(estado.abrirPlanos).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Fechar aviso" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("assinatura ativa não mostra faixa", () => {
    estado.assinatura = { ...base, situacao: "ativa", status: "ativa", diasRestantes: null };
    montar(<FaixaAssinatura />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("Premium no menu e modal de planos", () => {
  it("aparece no teste com os dias que faltam, abre o modal e some quando assina", async () => {
    const user = userEvent.setup();
    estado.assinatura = { ...base, diasRestantes: 3 };
    const { unmount } = montar(<ItemPremium />);
    expect(screen.getByText("Faltam 3 dias de teste")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Premium/ }));
    expect(estado.abrirPlanos).toHaveBeenCalledTimes(1);
    unmount();

    estado.assinatura = { ...base, diasRestantes: 0 };
    const ultimo = montar(<ItemPremium />);
    expect(screen.getByText("Último dia de teste")).toBeInTheDocument();
    ultimo.unmount();

    estado.assinatura = { ...base, situacao: "ativa", status: "ativa" };
    montar(<ItemPremium />);
    expect(screen.queryByText("Premium")).not.toBeInTheDocument();
  });

  it("modal de planos: só aparece aberto; dois planos com preço e WhatsApp, também para conta suspensa; fecha no X", async () => {
    const user = userEvent.setup();
    estado.assinatura = { ...base, situacao: "suspensa", status: "suspensa", somenteLeitura: true };
    const fechado = montar(<PlanosDialog />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fechado.unmount();

    estado.planosAbertos = true;
    montar(<PlanosDialog />);
    const modal = await screen.findByRole("dialog", { name: "Auttra Premium" });
    expect(modal).toHaveTextContent("42,90");
    expect(modal).toHaveTextContent("54,90");
    expect(screen.getByRole("link", { name: "Assinar o semestral" }).getAttribute("href")).toContain("wa.me/5548991268901");
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(estado.fecharPlanos).toHaveBeenCalled();
  });
});
