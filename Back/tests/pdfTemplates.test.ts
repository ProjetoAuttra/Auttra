import { describe, expect, it } from "vitest";
import {
  COR_PADRAO,
  assinaturas,
  cabecalho,
  corValida,
  dataBr,
  dataExtenso,
  dinheiro,
  documento,
  fechamento,
  paleta,
  quadroCliente,
  quadroVeiculo,
  recibo,
  tabelasItens,
  type ItemPdf,
} from "../src/services/pdfTemplates.js";

const oficina = { nome: `Oficina <img src=x onerror=alert(1)>`, cnpj: "12.345.678/0001-90", logradouro: "Rua A", numero: "10", cep: "01001000" };

const itens: ItemPdf[] = [
  { tipo: "servico", nome: "Troca", quantidade: 1, unitario: 50, subtotal: 50 },
  { tipo: "peca", nome: "Óleo 5W30", quantidade: "3.500", unidade: "L", unitario: 39.9, subtotal: 139.65 },
  { tipo: "peca", nome: "Filtro", quantidade: 1, unidade: "UN", unitario: 20, subtotal: 20 },
];

describe("pdfTemplates", () => {
  it("escapa HTML vindo da oficina e dos itens", () => {
    const topo = cabecalho(oficina, { tipo: "Orçamento", numero: 7, linhas: [{ rotulo: "Situação", valor: "<b>x</b>" }] });
    expect(topo).not.toContain("<img src=x");
    expect(topo).toContain("&lt;img src=x");
    expect(topo).not.toContain("<b>x</b>");
    expect(topo).toContain("Nº 0007");

    const tabela = tabelasItens([{ tipo: "peca", nome: "<script>x</script>", quantidade: 1, unitario: 10, subtotal: 10 }]);
    expect(tabela).not.toContain("<script>");
  });

  it("oficina sem endereço (cadastro pelo site): cabeçalho sem sobras de vírgula, traço, CEP ou null", () => {
    const topo = cabecalho(
      { nome: "Oficina Nova", logradouro: null, numero: null, cep: null, cidade: null, whatsapp: "11999990000" },
      { tipo: "Orçamento", numero: 1 }
    );
    expect(topo).toContain("Oficina Nova");
    expect(topo).toContain("WhatsApp: 11999990000");
    expect(topo).not.toMatch(/null|undefined|CEP|>\s*[,-]|[,-]\s*</);
  });

  it("separa serviços e peças, com unidade só nas peças e quantidade fracionada em pt-BR", () => {
    const html = tabelasItens(itens);
    expect(html).toContain(">Serviços<");
    expect(html).toContain(">Peças<");
    expect(html).toContain('<td class="num">3,5</td>');
    expect(html).toContain('<td class="c-un">L</td>');
    expect(html).toMatch(/Total de peças<\/td><td class="num">R\$\s159,65/);
    // Tabela de serviços não tem a coluna Un.
    const servicos = html.slice(0, html.indexOf(">Peças<"));
    expect(servicos).not.toContain("c-un");
  });

  it("omite a tabela sem itens e avisa quando não há nenhum", () => {
    expect(tabelasItens(itens.filter((i) => i.tipo === "peca"))).not.toContain(">Serviços<");
    expect(tabelasItens([])).toContain("Nenhum item adicionado");
  });

  it("quadro de totais soma serviços e peças e mostra o total geral informado", () => {
    const html = fechamento(itens, 209.65, [{ rotulo: "Formas de pagamento", valor: "Pix" }]);
    expect(html).toMatch(/Total de serviços<\/span><span>R\$\s50,00/);
    expect(html).toMatch(/Total de peças<\/span><span>R\$\s159,65/);
    expect(html).toMatch(/TOTAL GERAL<\/span><span>R\$\s209,65/);
    expect(html).toContain("Pix");
  });

  it("quadros de cliente e veículo escapam os dados e deixam campo vazio em branco", () => {
    const cli = quadroCliente({ nome: "Ana <i>", cpf: null, cidade: { nome: "Campinas", uf: "SP" } });
    expect(cli).toContain("Ana &lt;i&gt;");
    expect(cli).toContain("Campinas/SP");
    expect(cli).toContain("&nbsp;");

    const vei = quadroVeiculo({ marca: "VW", modelo: "Gol", placa: "abc1d23", quilometragem: 85320 }, { rotulo: "Responsável técnico", valor: "Carlos" });
    expect(vei).toContain("ABC1D23");
    expect(vei).toContain("85.320");
    expect(vei).toContain("Carlos");
  });

  it("só aceita logo raster embutida (data URI); URLs e SVG são ignorados", () => {
    const comLogo = cabecalho({ ...oficina, logo_url: "data:image/png;base64,iVBORw0KGgo=" }, { tipo: "OS", numero: 1 });
    expect(comLogo).toContain('<img src="data:image/png;base64,iVBORw0KGgo="');

    for (const url of ["http://evil.test/x.png", "data:image/svg+xml;base64,PHN2Zz4=", 'data:image/png;base64,AAA"onerror="x']) {
      expect(cabecalho({ ...oficina, logo_url: url }, { tipo: "OS", numero: 1 })).not.toContain("<img");
    }
  });

  it("formata moeda e datas (só-dia em UTC, instante em Brasília)", () => {
    expect(dinheiro(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
    expect(dinheiro(null).replace(/\s/g, " ")).toBe("R$ 0,00");
    expect(dataBr("2026-11-04T00:00:00.000Z")).toBe("04/11/2026");
    expect(dataBr("2026-11-04T01:00:00.000Z", true)).toBe("03/11/2026");
    expect(dataExtenso("2026-11-04T15:00:00.000Z")).toBe("4 de novembro de 2026");
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
    const html = documento({ ...oficina, nome: "X", cor_principal: "#e11d48" }, "<p>corpo</p>");
    expect(html).toContain("--cor: #e11d48");
    const padrao = documento({ ...oficina, nome: "X" }, "<p>corpo</p>");
    expect(padrao).toContain(`--cor: ${COR_PADRAO}`);
  });

  it("assinaturas: nome em negrito, linhas com <br>, termos e cidade escapados", () => {
    const html = assinaturas("Cliente", "Ana <b>\nOficina & Cia", { cidade: "São <Paulo>", termos: ["Garantia <90>"] });
    expect(html).toContain("<strong>Ana &lt;b&gt;</strong><br>Oficina &amp; Cia");
    expect(html).toContain("São &lt;Paulo&gt;, ");
    expect(html).toContain("Garantia &lt;90&gt;");
  });

  it("recibo sai em duas vias, com valor, extenso e forma de pagamento", () => {
    const html = recibo({ ...oficina, cidade: { nome: "Campinas", uf: "SP" } }, {
      numero: 31,
      valor: 100,
      extenso: "cem reais",
      pagador: "João <x>",
      documentoPagador: "123.456.789-00",
      referente: "Revisão",
      recebimentos: [
        { data: "2026-11-04T15:00:00.000Z", metodo: "Pix", valor: 60 },
        { data: "2026-11-05T15:00:00.000Z", metodo: "Cartão", valor: 40 },
      ],
      data: "2026-11-05T15:00:00.000Z",
      emissor: "Ana",
    });
    expect(html.match(/class="via"/g)).toHaveLength(2);
    expect(html).toContain("Via do cliente");
    expect(html).toContain("Via da oficina");
    expect(html).toContain("João &lt;x&gt;, CPF/CNPJ 123.456.789-00");
    expect(html).toContain("(cem reais)");
    expect(html).toMatch(/Pix R\$\s60,00 em 04\/11\/2026; Cartão R\$\s40,00 em 05\/11\/2026/);
    expect(html).toContain("Campinas, 5 de novembro de 2026.");
  });
});
