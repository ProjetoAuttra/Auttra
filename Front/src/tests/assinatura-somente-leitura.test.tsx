import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { AssinaturaProvider, useAssinatura } from "../context/AssinaturaContext";
import ModuleHeader from "../components/layout/ModuleHeader";
import { EVENTO_ASSINATURA_NECESSARIA, assinaturaNecessaria } from "../api/api";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../api/api", async (original) => {
  const real = await original<typeof import("../api/api")>();
  return { ...real, default: { get: mocks.get, post: vi.fn(), defaults: { headers: { common: {} } } } };
});

const todas = ["read", "create", "update", "delete"];
const usuario = {
  id: 1, email: "ana@oficina.com", nome: "Ana", tipo: "gestoroficina", oficinaId: 7, oficina_id: 7,
  permissoes: { clientes: todas, relatorios: todas },
};
const assinatura = (situacao: string, somenteLeitura: boolean) => ({
  situacao, status: situacao === "teste_vencido" ? "teste" : situacao, somenteLeitura, plano: null,
  testeTerminaEm: "2026-11-13T02:59:59.999Z", ativadaEm: null, diasRestantes: 0,
});

function Sonda() {
  const { can } = useAuth();
  const { planosAbertos, somenteLeitura } = useAssinatura();
  return (
    <div>
      <span data-testid="ler">{String(can("clientes"))}</span>
      <span data-testid="criar">{String(can("clientes", "create"))}</span>
      <span data-testid="relatorio">{String(can("relatorios", "create"))}</span>
      <span data-testid="leitura">{String(somenteLeitura)}</span>
      <span data-testid="planos">{String(planosAbertos)}</span>
    </div>
  );
}

const montar = (extra?: React.ReactNode) =>
  renderWithProviders(
    <AuthProvider>
      <AssinaturaProvider>
        <Sonda />
        {extra}
      </AssinaturaProvider>
    </AuthProvider>
  );

describe("conta só leitura no app", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("driveon:token", "token");
    localStorage.setItem("driveon:user", JSON.stringify(usuario));
    mocks.get.mockReset();
  });

  it("teste vencido: can() nega criar/editar/excluir (menos relatórios) e continua deixando ver", async () => {
    mocks.get.mockResolvedValue({ data: assinatura("teste_vencido", true) });
    montar();
    // O can() passa a negar um render depois de a situação chegar (o AuthContext é avisado por efeito).
    await waitFor(() => expect(screen.getByTestId("criar")).toHaveTextContent("false"));
    expect(screen.getByTestId("ler")).toHaveTextContent("true");
    expect(screen.getByTestId("relatorio")).toHaveTextContent("true");
  });

  it("em teste: o perfil decide, como sempre", async () => {
    mocks.get.mockResolvedValue({ data: { ...assinatura("teste", false), diasRestantes: 5 } });
    montar();
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith("/assinatura"));
    expect(screen.getByTestId("criar")).toHaveTextContent("true");
  });

  it("escrita recusada pelo back (402) recarrega a situação e abre o modal do Premium", async () => {
    // Abriu a tela ainda no teste; o teste venceu com ela aberta.
    mocks.get.mockResolvedValueOnce({ data: { ...assinatura("teste", false), diasRestantes: 0 } });
    montar();
    await waitFor(() => expect(screen.getByTestId("criar")).toHaveTextContent("true"));

    mocks.get.mockResolvedValueOnce({ data: assinatura("teste_vencido", true) });
    act(() => { window.dispatchEvent(new Event(EVENTO_ASSINATURA_NECESSARIA)); });
    expect(screen.getByTestId("planos")).toHaveTextContent("true");
    await waitFor(() => expect(screen.getByTestId("criar")).toHaveTextContent("false"));
  });

  it("botão de criar do cabeçalho leva ao Premium em vez de abrir o formulário", async () => {
    const user = userEvent.setup();
    const novo = vi.fn();
    mocks.get.mockResolvedValue({ data: assinatura("suspensa", true) });
    montar(<ModuleHeader title="Clientes" subtitle="" actionLabel="Novo Cliente" onAction={novo} />);
    await waitFor(() => expect(screen.getByTestId("criar")).toHaveTextContent("false"));

    await user.click(screen.getByRole("button", { name: "Novo Cliente" }));
    expect(novo).not.toHaveBeenCalled();
    expect(screen.getByTestId("planos")).toHaveTextContent("true");
  });
});

describe("assinaturaNecessaria", () => {
  const erro = (status: number, data: object) =>
    new AxiosError("x", "ERR", undefined, undefined, {
      status, data, statusText: "", headers: {}, config: { headers: new AxiosHeaders() },
    });

  it("reconhece só o 402 de assinatura", () => {
    expect(assinaturaNecessaria(erro(402, { code: "ASSINATURA_NECESSARIA" }))).toBe(true);
    expect(assinaturaNecessaria(erro(402, { code: "OUTRA_COISA" }))).toBe(false);
    expect(assinaturaNecessaria(erro(400, { code: "ASSINATURA_NECESSARIA" }))).toBe(false);
    expect(assinaturaNecessaria(new Error("rede"))).toBe(false);
  });
});
