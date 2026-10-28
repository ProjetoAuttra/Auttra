import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import api from "../api/api";
import SugestaoModal, { MODULOS_SUGESTAO } from "../components/layout/SugestaoModal";

vi.mock("../api/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), defaults: { headers: { common: {} } } },
}));

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("../context/ToastContext", () => ({ useToast: () => toast }));

describe("SugestaoModal", () => {
  beforeEach(() => vi.clearAllMocks());

  const setup = () => {
    const onClose = vi.fn();
    renderWithProviders(<SugestaoModal open onClose={onClose} />);
    return { onClose, user: userEvent.setup() };
  };
  const botaoEnviar = () => screen.getByRole("button", { name: /enviar sugestão/i });

  async function escolherModulo(user: ReturnType<typeof userEvent.setup>, nome: string) {
    await user.click(screen.getByRole("combobox", { name: /módulo/i }));
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: nome }));
  }

  it("lista os módulos do menu lateral e a opção Outros", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("combobox", { name: /módulo/i }));
    const opcoes = within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent);
    expect(opcoes).toEqual(MODULOS_SUGESTAO.map((m) => m.label));
    expect(opcoes.at(-1)).toBe("Outros");
  });

  it("só libera o envio com módulo escolhido e texto de pelo menos 10 caracteres", async () => {
    const { user } = setup();
    expect(botaoEnviar()).toBeDisabled();

    await escolherModulo(user, "Agenda");
    await user.type(screen.getByLabelText(/sua sugestão/i), "curta");
    expect(botaoEnviar()).toBeDisabled();

    await user.type(screen.getByLabelText(/sua sugestão/i), " demais, agora sim");
    expect(botaoEnviar()).toBeEnabled();
  });

  it("envia módulo e texto, agradece e fecha", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { id: 1 } });
    const { user, onClose } = setup();

    await escolherModulo(user, "Ordens de serviço");
    await user.type(screen.getByLabelText(/sua sugestão/i), "  Filtrar OS por mecânico.  ");
    await user.click(botaoEnviar());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith("/sugestoes", { modulo: "ordens", mensagem: "Filtrar OS por mecânico." });
    expect(toast.success).toHaveBeenCalled();
  });

  it("mostra o erro do servidor e mantém o modal aberto", async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { message: "Você enviou muitas sugestões em pouco tempo." } } });
    const { user, onClose } = setup();

    await escolherModulo(user, "Outros");
    await user.type(screen.getByLabelText(/sua sugestão/i), "Uma sugestão qualquer.");
    await user.click(botaoEnviar());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Você enviou muitas sugestões em pouco tempo."));
    expect(onClose).not.toHaveBeenCalled();
  });
});
