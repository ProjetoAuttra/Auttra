import * as React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import FiltrosRelatorio, { type CampoFiltro } from "../modules/relatorios/shared/FiltrosRelatorio";
import { periodoMesAtual } from "../modules/relatorios/shared/reportUtils";

vi.mock("../api/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), defaults: { headers: { common: {} } } },
}));

vi.mock("../components/common/CampoData", () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

type F = { de: string; ate: string; mecanicos: string[]; tipo: string };
const PADRAO: F = { de: "2026-10-01", ate: "2026-10-31", mecanicos: [], tipo: "" };
const campos: CampoFiltro<F>[] = [
  { id: "mecanicos", label: "Mecânico", multi: true, opcoes: [{ value: "Ana", label: "Ana" }, { value: "Bia", label: "Bia" }, { value: "Caio", label: "Caio" }] },
  { id: "tipo", label: "Tipo", opcoes: [{ value: "receber", label: "Receber" }, { value: "pagar", label: "Pagar" }] },
];

function Harness({ onChange }: { onChange: (f: F) => void }) {
  const [valores, setValores] = React.useState(PADRAO);
  React.useEffect(() => onChange(valores), [valores, onChange]);
  return <FiltrosRelatorio valores={valores} onChange={setValores} padrao={PADRAO} campos={campos} />;
}

describe("periodoMesAtual", () => {
  it("vai do dia 1 ao último dia do mês corrente, no fuso local", () => {
    const { de, ate } = periodoMesAtual();
    const hoje = new Date();
    expect(de).toBe(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`);
    const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    expect(ate.endsWith(`-${String(ultimo).padStart(2, "0")}`)).toBe(true);
  });
});

describe("FiltrosRelatorio", () => {
  it("muda o período na tela e mostra Limpar filtros só quando difere do padrão", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Data inicial"));
    await userEvent.type(screen.getByLabelText("Data inicial"), "2026-10-05");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ de: "2026-10-05" }));
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onChange).toHaveBeenLastCalledWith(PADRAO);
  });

  it("aplica seleção múltipla e única do painel só ao clicar em Aplicar", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    await userEvent.click(screen.getByRole("combobox", { name: "Mecânico" }));
    await userEvent.click(screen.getByRole("option", { name: "Ana" }));
    await userEvent.click(screen.getByRole("option", { name: "Caio" }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("combobox", { name: "Tipo" }));
    await userEvent.click(screen.getByRole("option", { name: "Pagar" }));
    expect(onChange).toHaveBeenLastCalledWith(PADRAO);
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...PADRAO, mecanicos: ["Ana", "Caio"], tipo: "pagar" });
  });

  it("Cancelar descarta o rascunho do painel", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    await userEvent.click(screen.getByRole("combobox", { name: "Tipo" }));
    await userEvent.click(screen.getByRole("option", { name: "Receber" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onChange).toHaveBeenLastCalledWith(PADRAO);
  });
});
