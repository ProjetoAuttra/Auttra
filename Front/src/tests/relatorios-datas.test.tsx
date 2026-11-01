import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "../api/api";
import { dateBr, inDateRange } from "../modules/relatorios/shared/reportUtils";
import { buscarTodas, LINHAS_POR_PAGINA, somarDias } from "../modules/relatorios/shared/buscarTodas";

vi.mock("../api/api", () => ({ default: { get: vi.fn(), defaults: { headers: { common: {} } } } }));

// Os testes rodam no fuso do Brasil: é aí que meia-noite UTC vira o dia anterior.
const fusoOriginal = process.env.TZ;
beforeEach(() => {
  process.env.TZ = "America/Sao_Paulo";
  return () => { process.env.TZ = fusoOriginal; };
});

describe("dateBr", () => {
  it("campo só-dia (meia-noite UTC) mostra o próprio dia, não o anterior", () => {
    expect(dateBr("2026-11-01T00:00:00.000Z")).toBe("01/11/2026");
  });

  it("instante com hora segue o fuso local", () => {
    // 01:30 UTC do dia 2 ainda é dia 1 às 22:30 no Brasil.
    expect(dateBr("2026-11-02T01:30:00.000Z")).toBe("01/11/2026");
  });

  it("vazio ou inválido vira '-'", () => {
    expect(dateBr(null)).toBe("-");
    expect(dateBr("lixo")).toBe("-");
  });
});

describe("inDateRange", () => {
  it("vencimento no primeiro dia do período entra (antes ficava de fora no Brasil)", () => {
    expect(inDateRange("2026-11-01T00:00:00.000Z", "2026-11-01", "2026-11-30")).toBe(true);
  });

  it("vencimento no dia seguinte ao fim fica de fora (antes entrava)", () => {
    expect(inDateRange("2026-12-01T00:00:00.000Z", "2026-11-01", "2026-11-30")).toBe(false);
  });

  it("instante com hora usa o dia local", () => {
    expect(inDateRange("2026-12-01T01:30:00.000Z", "2026-11-01", "2026-11-30")).toBe(true); // 30/11 às 22:30
    expect(inDateRange("2026-11-01T02:00:00.000Z", "2026-11-01", "2026-11-30")).toBe(false); // 31/10 às 23:00
  });

  it("vazio ou inválido não entra", () => {
    expect(inDateRange(null, "2026-11-01", "2026-11-30")).toBe(false);
    expect(inDateRange("lixo", "2026-11-01", "2026-11-30")).toBe(false);
  });
});

describe("buscarTodas", () => {
  const get = vi.mocked(api.get);
  const pagina = (inicio: number, qtd: number, total: number) => ({
    data: Array.from({ length: qtd }, (_, i) => ({ id: inicio + i })),
    headers: { "x-total-count": String(total) },
  });

  beforeEach(() => { get.mockReset(); });

  it("pede página a página até completar o total do X-Total-Count", async () => {
    get.mockImplementation(async (_url, cfg: any) => {
      const p = cfg.params.page;
      const total = 250;
      const inicio = (p - 1) * LINHAS_POR_PAGINA + 1;
      return pagina(inicio, Math.min(LINHAS_POR_PAGINA, total - inicio + 1), total);
    });

    const linhas = await buscarTodas<{ id: number }>("/pagamentos", { vencimento_de: "2026-11-01", vazio: "", nulo: null });

    expect(linhas).toHaveLength(250);
    expect(new Set(linhas.map((l) => l.id)).size).toBe(250);
    expect(get).toHaveBeenCalledTimes(3);
    expect(get).toHaveBeenCalledWith("/pagamentos", { params: { vencimento_de: "2026-11-01", page: 1, limit: LINHAS_POR_PAGINA } });
    expect(get).toHaveBeenCalledWith("/pagamentos", { params: { vencimento_de: "2026-11-01", page: 3, limit: LINHAS_POR_PAGINA } });
  });

  it("uma página só quando o total cabe nela", async () => {
    get.mockResolvedValue(pagina(1, 3, 3));
    expect(await buscarTodas("/clientes")).toHaveLength(3);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("endpoint sem X-Total-Count (não pagina) fica com a primeira resposta", async () => {
    get.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }], headers: {} });
    expect(await buscarTodas("/qualquer")).toHaveLength(2);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("descarta linha repetida quando um registro novo desloca as páginas", async () => {
    get.mockImplementation(async (_url, cfg: any) =>
      cfg.params.page === 1 ? pagina(1, LINHAS_POR_PAGINA, 101) : pagina(LINHAS_POR_PAGINA, 1, 101)
    );
    const linhas = await buscarTodas<{ id: number }>("/ordens");
    expect(linhas).toHaveLength(LINHAS_POR_PAGINA);
  });

  it("somarDias desloca o dia sem depender do fuso", () => {
    expect(somarDias("2026-11-01", -1)).toBe("2026-10-31");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
  });
});
