import { describe, expect, it } from "vitest";
import { valorPorExtenso } from "../src/utils/extenso.js";

describe("valorPorExtenso", () => {
  it.each([
    [0, "zero reais"],
    [1, "um real"],
    [2, "dois reais"],
    [11, "onze reais"],
    [21, "vinte e um reais"],
    [100, "cem reais"],
    [101, "cento e um reais"],
    [150, "cento e cinquenta reais"],
    [573, "quinhentos e setenta e três reais"],
    [1000, "mil reais"],
    [1200, "mil e duzentos reais"],
    [1234, "mil duzentos e trinta e quatro reais"],
    [2005, "dois mil e cinco reais"],
    [12500, "doze mil e quinhentos reais"],
    [100000, "cem mil reais"],
    [1_000_000, "um milhão de reais"],
    [2_500_000, "dois milhões e quinhentos mil reais"],
    [0.01, "um centavo"],
    [0.5, "cinquenta centavos"],
    [1.5, "um real e cinquenta centavos"],
    [1200.75, "mil e duzentos reais e setenta e cinco centavos"],
  ])("%s -> %s", (valor, esperado) => {
    expect(valorPorExtenso(valor)).toBe(esperado);
  });
});
