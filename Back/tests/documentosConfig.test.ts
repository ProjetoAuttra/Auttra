import { describe, expect, it } from "vitest";
import { normalizeDocumentosConfig, validarDocumentosConfig } from "../src/services/configuracoesOperacionais.service.js";
import { termoGarantia } from "../src/services/pdfTemplates.js";

describe("configuração de orçamentos e OS", () => {
  it("leitura cai no padrão (90 dias de garantia, 7 de validade) quando o valor falta ou é inválido", () => {
    expect(normalizeDocumentosConfig(null)).toEqual({ garantiaDias: 90, validadeOrcamentoDias: 7, observacoes: "" });
    expect(normalizeDocumentosConfig({ garantiaDias: 30, validadeOrcamentoDias: 0 })).toMatchObject({ garantiaDias: 90, validadeOrcamentoDias: 7 });
    expect(normalizeDocumentosConfig({ garantiaDias: 180, validadeOrcamentoDias: "15" })).toMatchObject({ garantiaDias: 180, validadeOrcamentoDias: 15 });
  });

  it("gravação aceita prazos válidos e limpa as observações", () => {
    expect(validarDocumentosConfig({ garantiaDias: "365", validadeOrcamentoDias: 30, observacoes: "  Texto  " })).toEqual({
      garantiaDias: 365,
      validadeOrcamentoDias: 30,
      observacoes: "Texto",
    });
    expect(validarDocumentosConfig({ garantiaDias: 90, validadeOrcamentoDias: 1 }).observacoes).toBe("");
  });

  it("gravação recusa garantia abaixo da legal, fracionada ou absurda", () => {
    for (const garantiaDias of [0, 89, 90.5, "abc", null, 3651]) {
      expect(() => validarDocumentosConfig({ garantiaDias, validadeOrcamentoDias: 7 })).toThrow(/garantia/);
    }
  });

  it("gravação recusa validade fora de 1 a 365 dias e observação longa demais", () => {
    for (const validadeOrcamentoDias of [0, -1, 366, 2.5]) {
      expect(() => validarDocumentosConfig({ garantiaDias: 90, validadeOrcamentoDias })).toThrow(/validade/);
    }
    expect(() => validarDocumentosConfig({ garantiaDias: 90, validadeOrcamentoDias: 7, observacoes: "x".repeat(1001) })).toThrow(/observações/);
  });

  it("termo de garantia: 90 dias cita o CDC; prazo maior é garantia da oficina", () => {
    expect(termoGarantia(90)).toContain("Garantia legal de 90 dias");
    expect(termoGarantia(90)).toContain("Código de Defesa do Consumidor");
    expect(termoGarantia(180)).toContain("Garantia de 180 dias");
    expect(termoGarantia(180)).not.toContain("Código de Defesa do Consumidor");
  });
});
