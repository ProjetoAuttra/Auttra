import { describe, expect, it } from "vitest";
import { linkWhatsApp, numeroWhatsApp, soDigitos } from "../utils/whatsapp";

describe("link do WhatsApp", () => {
  it("tira tudo que não é dígito (inclusive letras)", () => {
    expect(soDigitos("(11) 98765-4321")).toBe("11987654321");
    expect(soDigitos("DDD 11 9876")).toBe("119876");
    expect(soDigitos(null)).toBe("");
  });

  it("põe o 55 em DDD + número e aceita o número que já vem com 55", () => {
    expect(numeroWhatsApp("(11) 98765-4321")).toBe("5511987654321");
    expect(numeroWhatsApp("1133334444")).toBe("551133334444");
    expect(numeroWhatsApp("+55 11 98765-4321")).toBe("5511987654321");
  });

  it("número incompleto não vai para o link: o WhatsApp abre para escolher o contato", () => {
    expect(numeroWhatsApp("98765")).toBe("");
    expect(linkWhatsApp("", "Oi")).toBe("https://wa.me/?text=Oi");
  });

  it("codifica a mensagem", () => {
    expect(linkWhatsApp("11987654321", "Olá & tchau")).toBe("https://wa.me/5511987654321?text=Ol%C3%A1%20%26%20tchau");
  });
});
