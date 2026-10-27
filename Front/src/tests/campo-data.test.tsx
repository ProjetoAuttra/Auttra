import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import CampoData from "../components/common/CampoData";
import { renderWithProviders } from "./utils";

function Exemplo({ inicial = "", onValor }: { inicial?: string; onValor?: (v: string) => void }) {
  const [v, setV] = useState(inicial);
  return (
    <CampoData
      label="Data do recebimento"
      value={v}
      onChange={(x) => {
        setV(x);
        onValor?.(x);
      }}
    />
  );
}

const abrir = async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: /escolher data|choose date/i }));

describe("CampoData (calendário próprio)", () => {
  it("mostra a data em DD/MM/AAAA e abre o calendário personalizado (não o do navegador)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Exemplo inicial="2026-10-27" />);

    expect(screen.getByRole("group", { name: /data do recebimento/i })).toHaveTextContent("27/10/2026");
    await abrir(user);
    const calendario = await screen.findByRole("dialog");
    expect(within(calendario).getByText(/outubro 2026/i)).toBeInTheDocument();
    expect(within(calendario).getByRole("button", { name: "Hoje" })).toBeInTheDocument();
    expect(within(calendario).getByRole("button", { name: "Limpar" })).toBeInTheDocument();
  });

  it("cabeçalho da semana usa as iniciais D S T Q Q S S", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Exemplo inicial="2026-10-27" />);
    await abrir(user);
    const calendario = await screen.findByRole("dialog");
    const cabecalho = within(calendario).getAllByRole("columnheader").map((c) => c.textContent);
    expect(cabecalho).toEqual(["D", "S", "T", "Q", "Q", "S", "S"]);
  });

  it("escolher um dia devolve a data em YYYY-MM-DD", async () => {
    const onValor = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<Exemplo inicial="2026-10-27" onValor={onValor} />);

    await abrir(user);
    const calendario = await screen.findByRole("dialog");
    await user.click(within(calendario).getByRole("gridcell", { name: "15" }));

    expect(onValor).toHaveBeenLastCalledWith("2026-10-15");
  });

  it("Limpar zera o valor", async () => {
    const onValor = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<Exemplo inicial="2026-10-27" onValor={onValor} />);

    await abrir(user);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Limpar" }));
    await waitFor(() => expect(onValor).toHaveBeenLastCalledWith(""));
  });

  it("Hoje escolhe a data atual", async () => {
    const onValor = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<Exemplo inicial="2026-01-05" onValor={onValor} />);

    await abrir(user);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Hoje" }));

    const d = new Date();
    const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    await waitFor(() => expect(onValor).toHaveBeenLastCalledWith(hoje));
  });
});
