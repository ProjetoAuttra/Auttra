import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { theme } from "../app/theme";

const { criarCliente } = vi.hoisted(() => ({
  criarCliente: vi.fn().mockResolvedValue({ id: 42, nome: "Maria Silva" }),
}));

vi.mock("../api/client", () => ({ criarCliente }));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      nome: "Lucas Gaspar",
      oficina_id: 7,
      oficinaId: 7,
      oficina_nome: "Oficina DriveOn",
    },
  }),
}));

vi.mock("../modules/tarefas/dialog", () => ({ default: () => null }));
vi.mock("../modules/veiculos/dialog", () => ({ default: () => null }));
vi.mock("../modules/orcamentos/dialog", () => ({ default: () => null }));
vi.mock("../modules/clientes/dialog", () => ({
  default: ({ open, onSubmit }: { open: boolean; onSubmit: (data: { nome: string }) => void }) =>
    open ? (
      <button type="button" onClick={() => onSubmit({ nome: "Maria Silva" })}>
        Confirmar cliente simulado
      </button>
    ) : null,
}));

import Home from "../modules/painel/pages/Home";

describe("regressão: atalhos da Home", () => {
  it.fails("persiste o cliente criado pelo atalho usando o serviço de domínio", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <Home />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: /cadastrar cliente/i }));
    await user.click(screen.getByRole("button", { name: "Confirmar cliente simulado" }));

    expect(criarCliente).toHaveBeenCalledOnce();
    expect(criarCliente).toHaveBeenCalledWith({ nome: "Maria Silva" });
  });
});
