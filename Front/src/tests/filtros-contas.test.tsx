import * as React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import FiltrosContas, { filtrosPadrao, temFiltroAtivo, type FiltrosConta } from "../modules/pagamentos/components/FiltrosContas";

vi.mock("../api/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), defaults: { headers: { common: {} } } },
}));

vi.mock("../components/common/CampoData", () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

function Harness({ inicial = filtrosPadrao(), onChange }: { inicial?: FiltrosConta; onChange: (f: FiltrosConta) => void }) {
  const [filtros, setFiltros] = React.useState(inicial);
  React.useEffect(() => onChange(filtros), [filtros, onChange]);
  return (
    <FiltrosContas
      filtros={filtros}
      onChange={setFiltros}
      rotuloPago="Recebidos"
      rotuloParceiro="Cliente"
      parceiros={[{ id: 1, nome: "Ana" }, { id: 2, nome: "Bruno" }]}
    />
  );
}

describe("filtrosPadrao", () => {
  it("vai do dia 1 ao último dia do mês", () => {
    expect(filtrosPadrao(new Date(2026, 1, 10))).toMatchObject({ de: "2026-02-01", ate: "2026-02-28", status: [], metodos: [] });
    expect(filtrosPadrao(new Date(2028, 1, 10)).ate).toBe("2028-02-29");
    expect(filtrosPadrao(new Date(2026, 11, 31)).ate).toBe("2026-12-31");
  });

  it("só conta como filtro ativo o que difere do padrão", () => {
    const padrao = filtrosPadrao();
    expect(temFiltroAtivo(padrao, padrao)).toBe(false);
    expect(temFiltroAtivo({ ...padrao, status: ["pago"] }, padrao)).toBe(true);
    expect(temFiltroAtivo({ ...padrao, de: "2020-01-01" }, padrao)).toBe(true);
  });
});

describe("FiltrosContas", () => {
  it("seleciona vários status no dropdown", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);
    expect(screen.getByText("Todos os status")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "Status" }));
    await userEvent.click(screen.getByRole("option", { name: "Vencidos" }));
    await userEvent.click(screen.getByRole("option", { name: "Recebidos" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ status: ["vencido", "pago"] }));
  });

  it("muda o período direto na tela, sem abrir o painel", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);
    await userEvent.clear(screen.getByLabelText("Vencimento de"));
    await userEvent.type(screen.getByLabelText("Vencimento de"), "2026-03-01");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ de: "2026-03-01" }));
  });

  it("aplica formas de pagamento (várias) do painel só ao clicar em Aplicar e mostra a quantidade", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    await userEvent.click(screen.getByRole("combobox", { name: "Forma de pagamento" }));
    await userEvent.click(screen.getByRole("option", { name: "PIX" }));
    await userEvent.click(screen.getByRole("option", { name: "Boleto" }));
    await userEvent.keyboard("{Escape}");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ metodos: [] }));
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ metodos: ["pix", "boleto"] }));
    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeInTheDocument();
  });

  it("Limpar filtros volta ao padrão (mês atual, sem status)", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness inicial={{ ...filtrosPadrao(), status: ["pago"], de: "2020-01-01" }} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onChange).toHaveBeenLastCalledWith(filtrosPadrao());
  });
});
