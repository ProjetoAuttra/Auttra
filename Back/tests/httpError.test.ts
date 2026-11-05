import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { errorHandler } from "../src/middlewares/errorHandler.js";
import { HttpError, mensagemSegura, sendServiceError } from "../src/utils/httpError.js";

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

describe("mensagemSegura", () => {
  it("mostra o texto de erro de regra de negocio e esconde o de erro inesperado", () => {
    expect(mensagemSegura(new Error("Cliente nao encontrado."), "falhou")).toBe("Cliente nao encontrado.");
    expect(mensagemSegura(new HttpError("conflito", 409), "falhou")).toBe("conflito");
    expect(mensagemSegura(new TypeError("Invalid `prisma.cliente.create()` invocation: coluna x"), "falhou")).toBe("falhou");
    expect(mensagemSegura("texto solto")).toBe("Erro interno.");
  });
});

describe("errorHandler (erro que escapa de uma rota async)", () => {
  const appCom = (erro: unknown) => {
    const app = express();
    app.use(express.json());
    app.post("/x", async () => {
      throw erro;
    });
    app.use(errorHandler);
    return app;
  };

  it("erro inesperado vira 500 generico, sem a mensagem crua", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(appCom(new TypeError("Invalid `prisma.oficina.findFirst()` invocation"))).post("/x");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Erro interno." });
  });

  it("HttpError e Error de regra de negocio mantem status e texto", async () => {
    const http = await request(appCom(new HttpError("Ja respondido.", 409, "JA"))).post("/x");
    expect(http.status).toBe(409);
    expect(http.body).toEqual({ message: "Ja respondido.", code: "JA" });

    const negocio = await request(appCom(new Error("Orcamento nao encontrado."))).post("/x");
    expect(negocio.status).toBe(404);
  });

  it("JSON malformado continua 400", async () => {
    const res = await request(appCom(new Error("nao chega aqui"))).post("/x").set("Content-Type", "application/json").send("{ruim");
    expect(res.status).toBe(400);
  });
});
