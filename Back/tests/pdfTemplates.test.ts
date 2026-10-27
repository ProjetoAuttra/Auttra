import { describe, expect, it } from "vitest";
import { cabecalho, dataBr, dinheiro, tabelaItens } from "../src/services/pdfTemplates.js";

const oficina = { nome: `Oficina <img src=x onerror=alert(1)>`, cnpj: "12.345.678/0001-90", logradouro: "Rua A", numero: "10", cep: "01001000" };
const status = { label: "Em análise", classe: "info" };

describe("pdfTemplates", () => {
  it("escapa HTML vindo da oficina e dos itens", () => {
    const topo = cabecalho(oficina, { tipo: "Orçamento", numero: 7, status });
    expect(topo).not.toContain("<img src=x");
    expect(topo).toContain("&lt;img src=x");
    expect(topo).toContain("Nº 0007");

    const tabela = tabelaItens([{ tipo: "peca", nome: "<script>x</script>", quantidade: 1, unitario: 10, subtotal: 10 }], 10);
    expect(tabela).not.toContain("<script>");
  });

  it("só aceita logo raster embutida (data URI); URLs e SVG são ignorados", () => {
    const comLogo = cabecalho({ ...oficina, logo_url: "data:image/png;base64,iVBORw0KGgo=" }, { tipo: "OS", numero: 1, status });
    expect(comLogo).toContain('<img src="data:image/png;base64,iVBORw0KGgo="');

    for (const url of ["http://evil.test/x.png", "data:image/svg+xml;base64,PHN2Zz4=", 'data:image/png;base64,AAA"onerror="x']) {
      expect(cabecalho({ ...oficina, logo_url: url }, { tipo: "OS", numero: 1, status })).not.toContain("<img");
    }
  });

  it("formata moeda e datas (só-dia em UTC, instante em Brasília)", () => {
    expect(dinheiro(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
    expect(dinheiro(null).replace(/\s/g, " ")).toBe("R$ 0,00");
    expect(dataBr("2026-11-04T00:00:00.000Z")).toBe("04/11/2026");
    expect(dataBr("2026-11-04T01:00:00.000Z", true)).toBe("03/11/2026");
  });
});
