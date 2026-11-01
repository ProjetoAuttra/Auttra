import { describe, expect, it } from "vitest";
import { dataDoDia, hojeISO } from "../src/utils/datas.js";

describe("datas no fuso da oficina", () => {
  it("hojeISO usa o dia de São Paulo, não o de UTC", () => {
    expect(hojeISO(new Date("2026-10-31T02:30:00Z"))).toBe("2026-10-30"); // 23:30 em Brasília
    expect(hojeISO(new Date("2026-10-30T15:00:00Z"))).toBe("2026-10-30");
    expect(hojeISO(new Date("2026-10-31T03:00:00Z"))).toBe("2026-10-31"); // meia-noite em Brasília
  });

  it("dataDoDia grava o dia como o formulário de contas: meia-noite UTC", () => {
    expect(dataDoDia("2026-10-30").toISOString()).toBe("2026-10-30T00:00:00.000Z");
  });
});
