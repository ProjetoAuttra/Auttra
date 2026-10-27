import { describe, expect, it } from "vitest";
import { COR_PADRAO, assinaturas, cabecalho, corValida, dataBr, dinheiro, documento, paleta, tabelaItens } from "../src/services/pdfTemplates.js";

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

  it("cor da oficina: valida #RRGGBB e cai no padrão para qualquer outra coisa (o valor vai para o CSS)", () => {
    expect(corValida("#E11D48")).toBe("#e11d48");
    for (const ruim of [null, undefined, "", "red", "#fff", "#12345g", "#123456;}</style><script>x</script>", "url(x)"]) {
      expect(corValida(ruim as string)).toBe(COR_PADRAO);
    }
  });

  it("paleta: texto legível sobre a cor e cor escura para textos", () => {
    expect(paleta("#1e3a8a").sobrePrincipal).toBe("#ffffff");
    expect(paleta("#facc15").sobrePrincipal).toBe("#111827");
    // amarelo claro vira um tom escurecido para usar como texto sobre branco
    expect(paleta("#facc15").escura).not.toBe("#facc15");
    expect(paleta("#0f172a").escura).toBe("#0f172a");
  });

  it("o documento usa a cor da oficina no CSS", () => {
    const html = documento({ ...oficina, nome: "X", cor_principal: "#e11d48" }, "<p>corpo</p>", "Doc");
    expect(html).toContain("--cor: #e11d48");
    const padrao = documento({ ...oficina, nome: "X" }, "<p>corpo</p>", "Doc");
    expect(padrao).toContain(`--cor: ${COR_PADRAO}`);
  });

  it("assinaturas quebra linhas com <br> e escapa o texto", () => {
    const html = assinaturas("Cliente", "Ana <b>\nOficina & Cia");
    expect(html).toContain("Ana &lt;b&gt;<br>Oficina &amp; Cia");
  });
});
