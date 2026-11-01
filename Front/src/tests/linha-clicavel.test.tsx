import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Table, TableBody, TableCell, TableRow, IconButton } from "@mui/material";
import { linhaClicavel } from "../components/common/linhaClicavel";

function Lista({ abrir, menu }: { abrir: () => void; menu: () => void }) {
  return (
    <Table>
      <TableBody>
        <TableRow {...linhaClicavel(abrir)} data-testid="linha">
          <TableCell>Ana Costa</TableCell>
          <TableCell>
            <IconButton aria-label="Mais ações" onClick={menu}>⋮</IconButton>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

describe("linhaClicavel", () => {
  it("abre com um clique", async () => {
    const abrir = vi.fn();
    render(<Lista abrir={abrir} menu={vi.fn()} />);
    await userEvent.click(screen.getByText("Ana Costa"));
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it("abre pelo teclado com Enter", async () => {
    const abrir = vi.fn();
    render(<Lista abrir={abrir} menu={vi.fn()} />);
    screen.getByTestId("linha").focus();
    await userEvent.keyboard("{Enter}");
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it("clicar ou dar Enter no menu ⋮ não abre a linha", async () => {
    const abrir = vi.fn();
    const menu = vi.fn();
    render(<Lista abrir={abrir} menu={menu} />);
    const botao = screen.getByRole("button", { name: "Mais ações" });
    await userEvent.click(botao);
    botao.focus();
    await userEvent.keyboard("{Enter}");
    expect(menu).toHaveBeenCalledTimes(2);
    expect(abrir).not.toHaveBeenCalled();
  });
});
