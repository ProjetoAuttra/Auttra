import { describe, expect, it } from "vitest";
import {
  chaveCatalogo,
  deduplicar,
  entradasCuradas,
  normalizarMarcaFipe,
  reduzirModeloFipe,
} from "../src/services/catalogoVeiculos.service.js";

describe("catálogo de veículos: normalização da FIPE", () => {
  it("renomeia marcas com prefixo e acerta a caixa", () => {
    expect(normalizarMarcaFipe("GM - Chevrolet")).toBe("Chevrolet");
    expect(normalizarMarcaFipe("VW - VolksWagen")).toBe("Volkswagen");
    expect(normalizarMarcaFipe("Kia Motors")).toBe("Kia");
    expect(normalizarMarcaFipe("ASTON MARTIN")).toBe("Aston Martin");
    expect(normalizarMarcaFipe("BMW")).toBe("BMW");
    expect(normalizarMarcaFipe("BYD")).toBe("BYD");
    expect(normalizarMarcaFipe("Citroën")).toBe("Citroën");
  });

  it("reduz a versão da FIPE ao nome-base do modelo", () => {
    expect(reduzirModeloFipe("AGILE LTZ EFFECT EASYTR.1.4 8V FlexP. 5p")).toBe("Agile");
    expect(reduzirModeloFipe("Astra 2.0 8V/ CD 2.0 8V Hatchback 5p Aut")).toBe("Astra");
    expect(reduzirModeloFipe("Strada Working 1.4 Flex")).toBe("Strada");
    expect(reduzirModeloFipe("Grand Siena Attractive 1.4 Flex")).toBe("Grand Siena");
    expect(reduzirModeloFipe("Corolla Cross XRE 2.0 Flex Aut.")).toBe("Corolla Cross");
    expect(reduzirModeloFipe("118iA Full 1.6 TB 16V 170cv 5p")).toBe("118i");
    expect(reduzirModeloFipe("118i Sport 1.5 TB 12V Aut. 5p")).toBe("118i");
    expect(reduzirModeloFipe("Santa Fe GLS 3.5 V6 Aut.")).toBe("Santa Fe");
    expect(reduzirModeloFipe("Grand Santa Fé 3.3 V6 Aut.")).toBe("Grand Santa Fé");
    expect(reduzirModeloFipe("Ducato-10 Minibus 2.3")).toBe("Ducato");
    expect(reduzirModeloFipe("A-10 De Luxe 2.5/4.1")).toBe("A-10");
    expect(reduzirModeloFipe("AMAROK CD2.0 16V/S CD2.0 16V TDI 4x2 Die")).toBe("Amarok");
  });

  it("descarta o que não parece modelo", () => {
    expect(reduzirModeloFipe("")).toBeNull();
    expect(reduzirModeloFipe("1.6 Flex")).toBeNull();
    expect(reduzirModeloFipe("Band.Jipe Curto 2.4")).toBeNull();
    expect(reduzirModeloFipe("Coupe 2.0 16V")).toBeNull();
  });

  it("não duplica por acento ou caixa e mantém a primeira ocorrência", () => {
    expect(chaveCatalogo("Citroën", "C4")).toBe(chaveCatalogo("citroen", " c4 "));
    const r = deduplicar([
      { marca: "Citroën", modelo: "C4", origem: "curado" },
      { marca: "CITROEN", modelo: "c4", origem: "fipe" },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ marca: "Citroën", origem: "curado" });
  });

  it("a base curada não tem entradas repetidas", () => {
    const e = entradasCuradas();
    expect(deduplicar(e)).toHaveLength(e.length);
  });
});
