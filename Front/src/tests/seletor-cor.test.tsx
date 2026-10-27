import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SeletorCor, { COR_PADRAO, textoSobreCor } from "../components/common/SeletorCor";

const campoHex = () => screen.getByLabelText("Código hexadecimal da cor") as HTMLInputElement;

describe("SeletorCor", () => {
  it("mostra a cor padrão sem cor salva, a prévia e não oferece 'Restaurar padrão'", () => {
    render(<SeletorCor value={null} onChange={() => {}} />);
    expect(campoHex().value).toBe(COR_PADRAO.toUpperCase());
    expect(screen.getByTestId("previa-cor")).toBeInTheDocument();
    expect(screen.queryByText("Restaurar padrão")).toBeNull();
  });

  it("não tem cores sugeridas, só o seletor e o hex", () => {
    render(<SeletorCor value={null} onChange={() => {}} />);
    expect(screen.queryByLabelText("Vermelho")).toBeNull();
    expect(screen.getByLabelText("Escolher cor")).toBeInTheDocument();
  });

  it("digitar um hex completo devolve a cor; incompleto só sinaliza erro", () => {
    const onChange = vi.fn();
    render(<SeletorCor value={null} onChange={onChange} />);
    fireEvent.change(campoHex(), { target: { value: "#BE12" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Use o formato #RRGGBB")).toBeInTheDocument();
    fireEvent.change(campoHex(), { target: { value: "#BE123C" } });
    expect(onChange).toHaveBeenLastCalledWith("#be123c");
  });

  it("o seletor nativo devolve o hex em minúsculas e dá para restaurar o padrão", () => {
    const onChange = vi.fn();
    render(<SeletorCor value="#0f766e" onChange={onChange} />);
    expect(campoHex().value).toBe("#0F766E");
    fireEvent.change(screen.getByLabelText("Escolher cor"), { target: { value: "#FACC15" } });
    expect(onChange).toHaveBeenLastCalledWith("#facc15");
    fireEvent.click(screen.getByText("Restaurar padrão"));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("texto sobre a cor segue o contraste", () => {
    expect(textoSobreCor(COR_PADRAO)).toBe("#ffffff");
    expect(textoSobreCor("#facc15")).toBe("#111827");
  });
});
