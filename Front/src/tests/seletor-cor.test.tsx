import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SeletorCor, { COR_PADRAO, textoSobreCor } from "../components/common/SeletorCor";
import { renderWithProviders } from "./utils";

const abrir = () => fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
const campoHex = () => screen.getByLabelText("Código hexadecimal da cor") as HTMLInputElement;

describe("SeletorCor", () => {
  it("fora do modal só existe o botão Configurar: sem campo de texto e sem prévia", () => {
    renderWithProviders(<SeletorCor value={null} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Configurar" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByTestId("previa-cor")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clicar em Configurar abre o modal com o hex atual e a prévia", () => {
    renderWithProviders(<SeletorCor value="#0f766e" onChange={() => {}} />);
    abrir();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(campoHex().value.toLowerCase()).toBe("#0f766e");
    expect(screen.getByTestId("previa-cor")).toBeInTheDocument();
  });

  it("digitar um hex e aplicar devolve a cor em minúsculas", async () => {
    const onChange = vi.fn();
    renderWithProviders(<SeletorCor value={null} onChange={onChange} />);
    abrir();
    fireEvent.change(campoHex(), { target: { value: "#BE123C" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onChange).toHaveBeenCalledWith("#be123c");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("hex incompleto não pode ser aplicado e cancelar não altera nada", () => {
    const onChange = vi.fn();
    renderWithProviders(<SeletorCor value={null} onChange={onChange} />);
    abrir();
    fireEvent.change(campoHex(), { target: { value: "#BE1" } });
    expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("restaurar padrão devolve null; escolher a cor padrão também salva como padrão", async () => {
    const onChange = vi.fn();
    renderWithProviders(<SeletorCor value="#0f766e" onChange={onChange} />);
    abrir();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restaurar padrão" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    abrir();
    fireEvent.change(campoHex(), { target: { value: COR_PADRAO } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("texto sobre a cor segue o contraste", () => {
    expect(textoSobreCor(COR_PADRAO)).toBe("#ffffff");
    expect(textoSobreCor("#facc15")).toBe("#111827");
  });
});
