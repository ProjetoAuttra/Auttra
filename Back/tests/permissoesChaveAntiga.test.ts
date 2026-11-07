import { describe, expect, it } from "vitest";
import { canAccess, normalizePermissions, type PermissionsMap } from "../src/permissions/accessProfiles.js";

// "recursos_adicionais" virou "recursos_sistema". Tokens emitidos antes da troca ainda trazem a chave antiga.
describe("permissões com a chave antiga de Recursos do sistema", () => {
  const antiga = { painel: ["read"], recursos_adicionais: ["read", "update"] } as unknown as PermissionsMap;

  it("canAccess aceita a chave antiga do token", () => {
    expect(canAccess(antiga, "recursos_sistema", "update")).toBe(true);
    expect(canAccess(antiga, "recursos_sistema", "delete")).toBe(false);
  });

  it("normalizePermissions converte a chave antiga para a nova", () => {
    expect(normalizePermissions(antiga)).toEqual({ painel: ["read"], recursos_sistema: ["read", "update"] });
  });

  it("a chave nova prevalece quando as duas existem", () => {
    expect(normalizePermissions({ recursos_adicionais: ["read"], recursos_sistema: ["read", "update"] })).toEqual({
      recursos_sistema: ["read", "update"],
    });
  });
});
