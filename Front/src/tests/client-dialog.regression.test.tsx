import { ThemeProvider } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { theme } from "../app/theme";
import ClientDialog from "../modules/clientes/dialog";

function renderDialog(onSubmit: () => Promise<void>, onClose = vi.fn()) {
  render(
    <ThemeProvider theme={theme}>
      <ClientDialog
        open
        mode="create"
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </ThemeProvider>,
  );

  return { onClose };
}

async function fillRequiredFields() {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: /nome \/ razão social/i }), "Maria Silva");
  return user;
}

describe("regressão: submissão assíncrona de diálogos", () => {
  it.fails("mantém o diálogo aberto e preenchido quando a API falha", async () => {
    const failedRequest = Promise.reject(new Error("Falha simulada da API"));
    // Marca a rejeição como tratada mesmo enquanto o componente ainda não aguarda a Promise.
    void failedRequest.catch(() => undefined);
    const onSubmit = vi.fn(() => failedRequest);
    const { onClose } = renderDialog(onSubmit);
    const user = await fillRequiredFields();

    await user.click(screen.getByRole("button", { name: "Cadastrar cliente" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Novo cliente" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /nome \/ razão social/i })).toHaveValue("Maria Silva");
  });

  it.fails("bloqueia uma segunda submissão enquanto a primeira está pendente", async () => {
    const pendingRequest = new Promise<void>(() => undefined);
    const onSubmit = vi.fn(() => pendingRequest);
    renderDialog(onSubmit);
    const user = await fillRequiredFields();
    const submitButton = screen.getByRole("button", { name: "Cadastrar cliente" });

    await user.dblClick(submitButton);

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(submitButton).toBeDisabled();
  });
});
