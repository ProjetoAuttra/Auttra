import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import api from "../api/api";
import Configuracoes from "../modules/configuracoes/pages/configuracoes";

vi.mock("../api/api", () => ({
  default: { get: vi.fn(), put: vi.fn(), defaults: { headers: { common: {} } } },
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock("../context/ToastContext", () => ({ useToast: () => toast }));
const auth = vi.hoisted(() => ({ podeEditar: true }));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ can: (_m: string, acao = "read") => acao === "read" || auth.podeEditar }),
}));

const get = vi.mocked(api.get);
const put = vi.mocked(api.put);

const respostas: Record<string, unknown> = {
  "/configuracoes/documentos": { garantiaDias: 180, validadeOrcamentoDias: 15, observacoes: "Estadia após 30 dias." },
  "/configuracoes/agenda": { horarioInicio: "08:00", horarioFim: "18:00", dias: "Segunda a Sábado", tempoMedio: "60 minutos" },
  "/configuracoes/financeiro": { formasPagamento: "Pix, Cartão, Dinheiro", emitirRecibos: true, jurosAtraso: "2%" },
  "/notificacoes/config": {
    agenda: { ativo: true, diasAntecedencia: 1 },
    financeiro: { ativo: true, diasVencimento: 3 },
    estoque: { ativo: true, limiteBaixo: 3 },
    ordens: { ativo: true, diasParada: 3, diasCritico: 7 },
    orcamentos: { ativo: true, diasPendente: 2 },
  },
};

beforeEach(() => {
  get.mockReset();
  put.mockReset();
  Object.values(toast).forEach((fn) => fn.mockReset());
  auth.podeEditar = true;
  get.mockImplementation(async (url: string) => ({ data: structuredClone(respostas[url]) }));
  put.mockImplementation(async (_url: string, body: unknown) => ({ data: body }));
});

const abrir = (secao: string) => {
  renderWithProviders(
    <MemoryRouter initialEntries={[`/configuracoes?section=${secao}`]}>
      <Configuracoes />
    </MemoryRouter>
  );
  return userEvent.setup();
};

describe("Configurações > Orçamentos e OS", () => {
  it("abre já editável com os valores salvos e só carrega a seção aberta", async () => {
    abrir("documentos");
    expect(await screen.findByTestId("garantia-dias")).toHaveValue(180);
    expect(screen.getByTestId("validade-dias")).toHaveValue(15);
    expect(screen.getByTestId("observacoes")).toHaveValue("Estadia após 30 dias.");
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("/configuracoes/documentos");
  });

  it("Salvar só fica ativo quando algo muda", async () => {
    const user = abrir("documentos");
    const salvar = await screen.findByTestId("save-documentos");
    expect(salvar).toBeDisabled();
    await user.type(screen.getByTestId("validade-dias"), "0");
    expect(salvar).toBeEnabled();
  });

  it("não salva garantia menor que 90 dias e explica o motivo", async () => {
    const user = abrir("documentos");
    const garantia = await screen.findByTestId("garantia-dias");
    await user.clear(garantia);
    await user.type(garantia, "30");
    await user.click(screen.getByTestId("save-documentos"));

    expect(await screen.findByText(/mínimo de 90 dias \(garantia legal\)/i)).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it("salva o prazo novo e volta a desativar o Salvar", async () => {
    const user = abrir("documentos");
    const garantia = await screen.findByTestId("garantia-dias");
    await user.clear(garantia);
    await user.type(garantia, "365");
    await user.click(screen.getByTestId("save-documentos"));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("/configuracoes/documentos", { garantiaDias: 365, validadeOrcamentoDias: 15, observacoes: "Estadia após 30 dias." })
    );
    await waitFor(() => expect(screen.getByTestId("save-documentos")).toBeDisabled());
    expect(toast.success).toHaveBeenCalledWith("Configurações de orçamentos e OS salvas.");
  });

  it("Descartar volta ao último valor salvo", async () => {
    const user = abrir("documentos");
    const garantia = await screen.findByTestId("garantia-dias");
    await user.clear(garantia);
    await user.type(garantia, "999");
    await user.click(screen.getByTestId("descartar-documentos"));

    expect(garantia).toHaveValue(180);
    expect(screen.queryByTestId("descartar-documentos")).not.toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it("mostra a falha no lugar dos campos e tenta de novo", async () => {
    get.mockRejectedValueOnce(new Error("rede"));
    const user = abrir("documentos");
    await user.click(await screen.findByRole("button", { name: /tentar novamente/i }));
    expect(await screen.findByTestId("garantia-dias")).toHaveValue(180);
  });

  it("sem permissão de editar, os campos ficam bloqueados e não há Salvar", async () => {
    auth.podeEditar = false;
    abrir("documentos");
    expect(await screen.findByTestId("garantia-dias")).toBeDisabled();
    expect(screen.queryByTestId("save-documentos")).not.toBeInTheDocument();
  });
});

describe("Configurações > Agenda", () => {
  it("marca os dias a partir do texto salvo e grava no mesmo formato", async () => {
    const user = abrir("agenda");
    const dias = await screen.findByRole("group", { name: "Dias de atendimento" });
    expect(within(dias).getByRole("button", { name: "Sábado" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dias).getByRole("button", { name: "Domingo" })).toHaveAttribute("aria-pressed", "false");

    await user.click(within(dias).getByRole("button", { name: "Domingo" }));
    await user.click(screen.getByTestId("save-agenda"));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("/configuracoes/agenda", {
        horarioInicio: "08:00",
        horarioFim: "18:00",
        dias: "Todos os dias",
        tempoMedio: "60 minutos",
      })
    );
  });

  it("texto antigo fora do formato continua em campo livre, sem se perder", async () => {
    respostas["/configuracoes/agenda"] = { horarioInicio: "08:00", horarioFim: "18:00", dias: "Plantão no feriado", tempoMedio: "60 minutos" };
    abrir("agenda");
    expect(await screen.findByDisplayValue("Plantão no feriado")).toBeInTheDocument();
    respostas["/configuracoes/agenda"] = { horarioInicio: "08:00", horarioFim: "18:00", dias: "Segunda a Sábado", tempoMedio: "60 minutos" };
  });

  it("não salva término antes do início", async () => {
    const user = abrir("agenda");
    const termino = await screen.findByLabelText("Término");
    await user.clear(termino);
    await user.type(termino, "07:00");
    await user.click(screen.getByTestId("save-agenda"));

    expect(await screen.findByText("O término precisa ser depois do início.")).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });
});

describe("Configurações > Financeiro", () => {
  it("marca as formas pela lista do sistema e salva na ordem da lista", async () => {
    const user = abrir("financeiro");
    await user.click(await screen.findByRole("combobox", { name: "Formas de pagamento" }));
    const lista = await screen.findByRole("listbox");
    expect(within(lista).getByRole("option", { name: "PIX" })).toHaveAttribute("aria-selected", "true");
    expect(within(lista).getByRole("option", { name: "Boleto" })).toHaveAttribute("aria-selected", "false");

    await user.click(within(lista).getByRole("option", { name: "Boleto" }));
    await user.click(within(lista).getByRole("option", { name: "Dinheiro" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByTestId("save-financeiro"));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("/configuracoes/financeiro", expect.objectContaining({ formasPagamento: "PIX, Cartão, Boleto" }))
    );
  });

  it("forma antiga fora da lista continua marcada", async () => {
    respostas["/configuracoes/financeiro"] = { formasPagamento: "Pix, Cheque", emitirRecibos: true, jurosAtraso: "2%" };
    const user = abrir("financeiro");
    await user.click(await screen.findByRole("combobox", { name: "Formas de pagamento" }));
    expect(within(await screen.findByRole("listbox")).getByRole("option", { name: "Cheque" })).toHaveAttribute("aria-selected", "true");
    respostas["/configuracoes/financeiro"] = { formasPagamento: "Pix, Cartão, Dinheiro", emitirRecibos: true, jurosAtraso: "2%" };
  });

  it("não salva sem nenhuma forma de pagamento", async () => {
    respostas["/configuracoes/financeiro"] = { formasPagamento: "Pix", emitirRecibos: true, jurosAtraso: "2%" };
    const user = abrir("financeiro");
    await user.click(await screen.findByRole("combobox", { name: "Formas de pagamento" }));
    await user.click(within(await screen.findByRole("listbox")).getByRole("option", { name: "PIX" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByTestId("save-financeiro"));
    expect(await screen.findByText("Escolha pelo menos uma forma de pagamento.")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma forma de pagamento selecionada")).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
    respostas["/configuracoes/financeiro"] = { formasPagamento: "Pix, Cartão, Dinheiro", emitirRecibos: true, jurosAtraso: "2%" };
  });
});

describe("Configurações > Notificações", () => {
  it("desligar uma regra bloqueia os campos dela e salva", async () => {
    const user = abrir("notificacoes");
    const limite = await screen.findByTestId("estoque-limiteBaixo");
    expect(limite).toBeEnabled();

    await user.click(screen.getByRole("switch", { name: "Avisar estoque baixo" }));
    expect(limite).toBeDisabled();

    await user.click(screen.getByTestId("save-notificacoes"));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith("/notificacoes/config", expect.objectContaining({ estoque: { ativo: false, limiteBaixo: 3 } }))
    );
  });
});
