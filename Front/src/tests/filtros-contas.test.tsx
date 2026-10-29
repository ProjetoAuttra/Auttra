import * as React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./utils";
import FiltrosContas, { filtrosPadrao, paramsFiltros, temFiltroAtivo, type FiltrosConta } from "../modules/pagamentos/components/FiltrosContas";

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
      tipo="receber"
      rotuloParceiro="Cliente"
      parceiros={[{ id: 1, nome: "Ana" }, { id: 2, nome: "Bruno" }]}
    />
  );
}

describe("filtrosPadrao", () => {
  it("vai do dia 1 ao último dia do mês", () => {
    expect(filtrosPadrao(new Date(2026, 1, 10))).toMatchObject({ de: "2026-02-01", ate: "2026-02-28", situacao: [], dataPor: "vencimento", metodos: [] });
    expect(filtrosPadrao(new Date(2028, 1, 10)).ate).toBe("2028-02-29");
    expect(filtrosPadrao(new Date(2026, 11, 31)).ate).toBe("2026-12-31");
  });

  it("só conta como filtro ativo o que difere do padrão", () => {
    const padrao = filtrosPadrao();
    expect(temFiltroAtivo(padrao, padrao)).toBe(false);
    expect(temFiltroAtivo({ ...padrao, situacao: ["pago"] }, padrao)).toBe(true);
    expect(temFiltroAtivo({ ...padrao, de: "2020-01-01" }, padrao)).toBe(true);
    expect(temFiltroAtivo({ ...padrao, dataPor: "pagamento" }, padrao)).toBe(true);
  });
});

describe("FiltrosContas", () => {
  it("troca a data de referência entre vencimento e recebimento", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Data" }));
    await userEvent.click(screen.getByRole("option", { name: "Recebimento" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ dataPor: "pagamento" }));
  });

  it("seleciona várias situações no painel e só aplica ao clicar em Aplicar", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    await userEvent.click(screen.getByRole("combobox", { name: "Situação" }));
    await userEvent.click(screen.getByRole("option", { name: "Vencidos" }));
    await userEvent.click(screen.getByRole("option", { name: "Recebidos" }));
    await userEvent.keyboard("{Escape}");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ situacao: [] }));
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ situacao: ["vencido", "pago"] }));
  });

  it("muda o período direto na tela, sem abrir o painel", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);
    await userEvent.clear(screen.getByLabelText("Data inicial"));
    await userEvent.type(screen.getByLabelText("Data inicial"), "2026-03-01");
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

  it("Limpar filtros volta ao padrão (vencimento no mês atual, sem situação)", async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness inicial={{ ...filtrosPadrao(), situacao: ["pago"], de: "2020-01-01" }} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(onChange).toHaveBeenLastCalledWith(filtrosPadrao());
  });
});

describe("paramsFiltros", () => {
  it("por vencimento manda vencimento_de/ate e a data de hoje se houver 'vencido'", () => {
    const p = paramsFiltros({ ...filtrosPadrao(new Date(2026, 9, 5)), situacao: ["vencido", "pago"], metodos: ["pix"], parceiroId: "3" }, "cliente_id");
    expect(p).toMatchObject({ status: "vencido,pago", vencimento_de: "2026-10-01", vencimento_ate: "2026-10-31", metodo: "pix", cliente_id: "3", tz_offset: "" });
    expect(p.hoje).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(p).not.toHaveProperty("pagamento_de");
  });

  it("por recebimento manda pagamento_de/ate e o fuso", () => {
    const p = paramsFiltros({ ...filtrosPadrao(new Date(2026, 9, 5)), dataPor: "pagamento" }, "fornecedor_id");
    expect(p).toMatchObject({ pagamento_de: "2026-10-01", pagamento_ate: "2026-10-31", hoje: "", fornecedor_id: "" });
    expect(p.tz_offset).toBe(String(new Date().getTimezoneOffset()));
    expect(p).not.toHaveProperty("vencimento_de");
  });
});
