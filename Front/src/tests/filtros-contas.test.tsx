import * as React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import FiltrosContas, { FILTROS_AVANCADOS_VAZIOS, type FiltrosAvancados, type StatusConta } from "../modules/pagamentos/components/FiltrosContas";

vi.mock("../api/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), defaults: { headers: { common: {} } } },
}));

vi.mock("../components/common/CampoData", () => ({
  default: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

function Harness({ inicial = FILTROS_AVANCADOS_VAZIOS, onChange }: { inicial?: FiltrosAvancados; onChange: (s: StatusConta, f: FiltrosAvancados) => void }) {
  const [status, setStatus] = React.useState<StatusConta>("todos");
  const [avancados, setAvancados] = React.useState(inicial);
  React.useEffect(() => onChange(status, avancados), [status, avancados, onChange]);
  return (
    <FiltrosContas
      status={status}
      onStatusChange={setStatus}
      avancados={avancados}
      onAvancadosChange={setAvancados}
      rotuloPago="Recebidos"
      rotuloParceiro="Cliente"
      parceiros={[{ id: 1, nome: "Ana" }, { id: 2, nome: "Bruno" }]}
    />
  );
}

describe("FiltrosContas", () => {
  it("troca o status direto na tela", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Vencidos" }));
    expect(onChange).toHaveBeenLastCalledWith("vencido", FILTROS_AVANCADOS_VAZIOS);
    expect(screen.getByRole("button", { name: "Recebidos" })).toBeInTheDocument();
  });

  it("aplica os filtros do painel só ao clicar em Aplicar e mostra a quantidade", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    await userEvent.type(screen.getByLabelText("De"), "2026-03-01");
    expect(onChange).toHaveBeenLastCalledWith("todos", FILTROS_AVANCADOS_VAZIOS);
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onChange).toHaveBeenLastCalledWith("todos", { ...FILTROS_AVANCADOS_VAZIOS, de: "2026-03-01" });
    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeInTheDocument();
  });

  it("bloqueia o período invertido e limpa os filtros ativos", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness inicial={{ ...FILTROS_AVANCADOS_VAZIOS, de: "2026-05-01", metodo: "pix" }} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    await userEvent.type(screen.getByLabelText("Até"), "2026-04-01");
    expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onChange).toHaveBeenLastCalledWith("todos", FILTROS_AVANCADOS_VAZIOS);
  });
});
