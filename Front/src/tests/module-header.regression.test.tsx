import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { theme } from "../app/theme";
import ModuleHeader from "../components/layout/ModuleHeader";

describe("regressão: ModuleHeader", () => {
  it.fails("renderiza busca, métricas e ações recebidas por props", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    const onAction = vi.fn();

    render(
      <ThemeProvider theme={theme}>
        <ModuleHeader
          title="Clientes"
          subtitle="Gerencie a carteira de clientes"
          metrics={[{ label: "Cadastrados", value: 12 }]}
          searchValue=""
          searchPlaceholder="Pesquisar clientes"
          onSearchChange={onSearchChange}
          actionLabel="Novo cliente"
          onAction={onAction}
        />
      </ThemeProvider>,
    );

    const search = screen.getByRole("textbox", { name: "Pesquisar clientes" });
    expect(screen.getByText("Cadastrados")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();

    await user.type(search, "Maria");
    await user.click(screen.getByRole("button", { name: "Novo cliente" }));

    expect(onSearchChange).toHaveBeenLastCalledWith("Maria");
    expect(onAction).toHaveBeenCalledOnce();
  });
});
