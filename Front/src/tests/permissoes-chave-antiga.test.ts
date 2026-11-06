import { describe, expect, it } from "vitest";
import { hasPermission, type PermissionsMap } from "../permissions/accessProfiles";

// Usuário salvo no navegador antes de "recursos_adicionais" virar "recursos_sistema".
describe("hasPermission com a chave antiga de Recursos do sistema", () => {
  it("vale como a chave nova até o próximo login", () => {
    const antiga = { recursos_adicionais: ["read", "update"] } as unknown as PermissionsMap;
    expect(hasPermission(antiga, "recursos_sistema", "update")).toBe(true);
    expect(hasPermission(antiga, "recursos_sistema", "delete")).toBe(false);
  });

  it("usa a chave nova quando existe", () => {
    expect(hasPermission({ recursos_sistema: ["read"] }, "recursos_sistema")).toBe(true);
    expect(hasPermission({}, "recursos_sistema")).toBe(false);
  });
});
