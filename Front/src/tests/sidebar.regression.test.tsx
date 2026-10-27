import { useEffect } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { theme } from "../app/theme";
import AppSidebar from "../components/layout/AppSidebar";
import { SidebarProvider, useSidebar } from "../context/SidebarContext";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock("../context/AdditionalResourcesContext", () => ({
  useAdditionalResources: () => ({ isEnabled: () => true }),
}));

function CollapseSidebar() {
  const { setCollapsed } = useSidebar();

  useEffect(() => {
    setCollapsed(true);
  }, [setCollapsed]);

  return <AppSidebar drawerWidth={248} />;
}

describe("regressão: navegação recolhida", () => {
  it.fails("permite acessar os subitens de um grupo", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={["/"]}>
          <SidebarProvider>
            <CollapseSidebar />
          </SidebarProvider>
        </MemoryRouter>
      </ThemeProvider>,
    );

    const financeiro = await screen.findAllByRole("button", { name: "Financeiro" });
    await user.click(financeiro[0]);

    expect(screen.getByRole("button", { name: "Extrato" })).toBeInTheDocument();
  });
});
