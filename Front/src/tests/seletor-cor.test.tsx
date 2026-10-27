import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SeletorCor, { COR_PADRAO, textoSobreCor } from "../components/common/SeletorCor";

describe("SeletorCor", () => {
  it("marca a cor padrão quando não há cor salva e mostra a prévia", () => {
    render(<SeletorCor value={null} onChange={() => {}} />);
    expect(screen.getByLabelText("Azul-marinho")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Restaurar padrão")).toBeNull();
    expect(screen.getByTestId("previa-cor")).toBeInTheDocument();
  });

  it("escolher uma sugestão devolve o hex; escolher a padrão devolve null", () => {
    const onChange = vi.fn();
    render(<SeletorCor value={null} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Vermelho"));
    expect(onChange).toHaveBeenLastCalledWith("#be123c");
    fireEvent.click(screen.getByLabelText("Azul-marinho"));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("aceita cor livre, mostra o hex atual e permite restaurar o padrão", () => {
    const onChange = vi.fn();
    render(<SeletorCor value="#0f766e" onChange={onChange} />);
    expect(screen.getByText("#0F766E")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Escolher outra cor", { selector: "input" }), { target: { value: "#FACC15" } });
    expect(onChange).toHaveBeenLastCalledWith("#facc15");
    fireEvent.click(screen.getByText("Restaurar padrão"));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("texto sobre a cor segue o contraste", () => {
    expect(textoSobreCor(COR_PADRAO)).toBe("#ffffff");
    expect(textoSobreCor("#facc15")).toBe("#111827");
  });
});
