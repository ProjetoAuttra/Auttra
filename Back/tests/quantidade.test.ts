import { Prisma } from "../src/generated/prisma/client.js";
import { describe, expect, it } from "vitest";
import { HttpError } from "../src/utils/httpError.js";
import { formatarQuantidade, parseQuantidade, parseUnidade, unidadeDaNota } from "../src/utils/quantidade.js";

describe("parseQuantidade", () => {
  it.each([
    ["3,5", "3.5"],
    ["3.5", "3.5"],
    [3.5, "3.5"],
    [" 2 ", "2"],
    ["0,001", "0.001"],
    [99999, "99999"],
    [new Prisma.Decimal("1.250"), "1.25"],
  ])("aceita %j", (entrada, esperado) => {
    expect(parseQuantidade(entrada).toString()).toBe(esperado);
  });

  it.each([0, -1, "abc", 1.2345, "1,2345", "", null, undefined, 100000, Number.NaN, Infinity, "1e3", "3,5,1"])(
    "recusa %j com 400 QUANTIDADE_INVALIDA",
    (entrada) => {
      try {
        parseQuantidade(entrada);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        expect(err).toMatchObject({ status: 400, code: "QUANTIDADE_INVALIDA", message: "Quantidade inválida." });
      }
    }
  );

  it("zero só passa quando permitido (estoque da peça)", () => {
    expect(parseQuantidade(0, true).toString()).toBe("0");
    expect(() => parseQuantidade(-1, true)).toThrow(HttpError);
  });
});

describe("unidade", () => {
  it("aceita UN, L, KG e M sem diferenciar maiúsculas", () => {
    expect(parseUnidade("l")).toBe("L");
    expect(parseUnidade(" kg ")).toBe("KG");
    expect(() => parseUnidade("CX")).toThrow(/Unidade inválida/);
  });

  it("converte o uCom da NF-e", () => {
    expect(unidadeDaNota("LT")).toBe("L");
    expect(unidadeDaNota("kg")).toBe("KG");
    expect(unidadeDaNota("MT")).toBe("M");
    expect(unidadeDaNota("PC")).toBe("UN");
    expect(unidadeDaNota(undefined)).toBe("UN");
  });

  it("formata em pt-BR com a unidade", () => {
    expect(formatarQuantidade(new Prisma.Decimal("3.500"), "L")).toBe("3,5 L");
    expect(formatarQuantidade("1234.5")).toBe("1.234,5");
    expect(formatarQuantidade(2, "UN")).toBe("2 UN");
  });
});
