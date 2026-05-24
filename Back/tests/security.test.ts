import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";

describe("security baseline", () => {
  it("exposes health without auth", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("blocks notifications without token", async () => {
    const response = await request(app).get("/api/notificacoes");

    expect(response.status).toBe(401);
  });

  it("blocks city writes without token", async () => {
    const response = await request(app)
      .post("/api/cidade")
      .send({ nome: "Teste", uf: "SP" });

    expect(response.status).toBe(401);
  });

  it("rejects insecure JWT secrets in production", () => {
    const previousEnv = process.env.NODE_ENV;
    const previousSecret = process.env.JWT_SECRET;
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "troque-esta-chave-em-producao";

    expect(() => getJwtSecret()).toThrow("JWT_SECRET inseguro");

    process.env.NODE_ENV = previousEnv;
    process.env.JWT_SECRET = previousSecret;
  });
});
