import { describe, expect, it } from "vitest";
import { CATALOGO_LOCAL, criarCatalogo } from "../modules/veiculos/catalogo";

const { marcaConhecida, marcaDoModelo, modelosSugeridos, todosModelos } = CATALOGO_LOCAL;
const TODOS_MODELOS = todosModelos;

describe("catálogo de veículos", () => {
  it("sugere só os modelos da marca informada, ignorando caixa e acento", () => {
    const modelos = modelosSugeridos("fiat").map((o) => o.modelo);
    expect(modelos).toContain("Argo");
    expect(modelos).not.toContain("Onix");
    expect(modelosSugeridos("citroen").every((o) => o.marca === "Citroën")).toBe(true);
  });

  it("sem marca conhecida sugere todos os modelos", () => {
    expect(modelosSugeridos("")).toHaveLength(TODOS_MODELOS.length);
    expect(modelosSugeridos("Marca Inventada")).toHaveLength(TODOS_MODELOS.length);
  });

  it("deduz a marca pelo modelo quando ele é único", () => {
    expect(marcaDoModelo("onix")).toBe("Chevrolet");
    expect(marcaDoModelo("Modelo Inventado")).toBeNull();
    expect(marcaConhecida("VOLKSWAGEN")).toBe("Volkswagen");
  });

  it("monta o catálogo a partir do mapa vindo da API", () => {
    const c = criarCatalogo({ Zeta: ["Z1", "Alfa"], Beta: ["B1"] });
    expect(c.marcas).toEqual(["Beta", "Zeta"]);
    expect(c.modelosSugeridos("zeta").map((o) => o.modelo)).toEqual(["Alfa", "Z1"]);
    expect(c.marcaDoModelo("b1")).toBe("Beta");
  });

  it("modelo repetido em duas marcas não deduz a marca", () => {
    expect(criarCatalogo({ A: ["X"], B: ["X"] }).marcaDoModelo("X")).toBeNull();
  });
});
