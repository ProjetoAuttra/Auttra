import { describe, expect, it, vi } from "vitest";
import { HttpError, sendServiceError } from "../src/utils/httpError.js";

function fakeRes() {
  const res: any = { statusCode: 0, body: undefined };
  res.status = (code: number) => ((res.statusCode = code), res);
  res.json = (body: unknown) => ((res.body = body), res);
  return res;
}

describe("sendServiceError", () => {
  it("HttpError usa status e code proprios", () => {
    const res = fakeRes();
    sendServiceError(res, new HttpError("conflito", 409, "X"), "t");
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ message: "conflito", code: "X" });
  });

  it("Error de regra de negocio vira 400 e 'nao encontrado' vira 404", () => {
    const a = fakeRes();
    sendServiceError(a, new Error("Valor invalido."), "t");
    expect(a.statusCode).toBe(400);

    const b = fakeRes();
    sendServiceError(b, new Error("Pagamento não encontrado."), "t");
    expect(b.statusCode).toBe(404);
  });

  it("erro inesperado vira 500 generico sem vazar detalhes", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = fakeRes();
    sendServiceError(res, new TypeError("Cannot read properties of undefined (reading 'x')"), "t");
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: "Erro interno." });
  });
});
