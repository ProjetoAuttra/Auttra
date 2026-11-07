import * as React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import BarraFiltros, { type CampoFiltro } from "../components/common/BarraFiltros";
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
  return <BarraFiltros valores={valores} onChange={setValores} padrao={PADRAO} campos={campos} />;
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

describe("BarraFiltros", () => {
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

describe("BarraFiltros: busca e campos mantidos", () => {
  type G = { visao: string; de: string; ate: string; cliente: string; tipo: string };
  const PADRAO_G: G = { visao: "a", de: "2026-10-01", ate: "2026-10-31", cliente: "", tipo: "todos" };
  const camposG: CampoFiltro<G>[] = [
    { id: "cliente", label: "Cliente", busca: true, opcoes: [{ value: "1", label: "Ana Costa" }, { value: "2", label: "Bruno Lima" }] },
  ];
  function HarnessG({ onChange }: { onChange: (g: G) => void }) {
    const [valores, setValores] = React.useState<G>({ ...PADRAO_G, visao: "b" });
    React.useEffect(() => onChange(valores), [valores, onChange]);
    return <BarraFiltros valores={valores} onChange={setValores} padrao={PADRAO_G} campos={camposG} manter={["visao"]} />;
  }

  it("escolhe pela busca, conta no botão, e Limpar filtros mantém o campo marcado como mantido", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<HarnessG onChange={onChange} />);
    // A visão diferente do padrão não conta como filtro.
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Filtros/ }));
    await user.type(screen.getByRole("combobox", { name: "Cliente" }), "Bru");
    await user.click(await screen.findByRole("option", { name: "Bruno Lima" }));
    await user.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ cliente: "2" }));
    expect(screen.getByText("1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...PADRAO_G, visao: "b" });
  });
});
