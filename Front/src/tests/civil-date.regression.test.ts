import { describe, expect, it } from "vitest";

function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

describe("regressão: datas civis", () => {
  it.fails("não desloca YYYY-MM-DD para o dia anterior em America/Sao_Paulo", () => {
    const civilDate = "2026-10-26";

    // Este é o padrão inseguro que ainda existe no produto e será removido no IMP-004.
    const parsedWithCurrentPattern = new Date(civilDate);

    expect(dateInTimeZone(parsedWithCurrentPattern, "America/Sao_Paulo")).toBe(civilDate);
  });
});
