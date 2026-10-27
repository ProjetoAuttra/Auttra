import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import TextoLimitado from "../components/common/TextoLimitado";
import { renderWithProviders } from "./utils";

const medidas = (scrollHeight: number, clientHeight: number) => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => scrollHeight });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => clientHeight });
};

const LONGO = "Entrada do orçamento aprovado (saldo do recebimento parcial) com um texto bem comprido";

describe("TextoLimitado", () => {
  afterEach(() => {
    delete (HTMLElement.prototype as any).scrollHeight;
    delete (HTMLElement.prototype as any).clientHeight;
  });

  it("limita a quantidade de linhas por CSS", () => {
    renderWithProviders(<TextoLimitado texto={LONGO} linhas={2} />);
    const el = screen.getByText(LONGO);
    expect(getComputedStyle(el).overflow).toBe("hidden");
    expect(el.getAttribute("class")).toBeTruthy();
  });

  it("quando o texto foi cortado, o hover mostra o texto completo", async () => {
    medidas(80, 40);
    renderWithProviders(<TextoLimitado texto={LONGO} />);
    fireEvent.mouseOver(screen.getByText(LONGO));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(LONGO);
  });

  it("quando cabe inteiro, não aparece tooltip", async () => {
    medidas(40, 40);
    renderWithProviders(<TextoLimitado texto="Curto" />);
    fireEvent.mouseOver(screen.getByText("Curto"));
    await new Promise((r) => setTimeout(r, 450));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
