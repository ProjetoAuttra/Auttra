import request from "supertest";
import jwt from "jsonwebtoken";
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

  it("allows public tracking lookup without token", async () => {
    const response = await request(app).get("/api/public/acompanhamento/CODIGO_INVALIDO");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Link expirado ou inválido." });
  });

  it("blocks city writes without token", async () => {
    const response = await request(app)
      .post("/api/cidade")
      .send({ nome: "Teste", uf: "SP" });

    expect(response.status).toBe(401);
  });

  it("blocks admin routes without token", async () => {
    const response = await request(app).get("/api/admin/oficinas");

    expect(response.status).toBe(401);
  });

  it("blocks admin routes for non-system users", async () => {
    const token = jwt.sign(
      { id: 1, email: "gestor@example.com", nome: "Gestor", tipo: "gestoroficina" },
      getJwtSecret(),
      { expiresIn: "5m" }
    );

    const response = await request(app)
      .get("/api/admin/oficinas")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
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

  it("does not accept the JWT via query string", async () => {
    const token = jwt.sign({ id: 1, tipo: "funcionario", oficinaId: 1 }, getJwtSecret());
    const response = await request(app).get(`/api/notificacoes?token=${token}`);

    expect(response.status).toBe(401);
  });

  it("rejects office tokens with tipo sistema on admin routes", async () => {
    const token = jwt.sign({ id: 1, tipo: "sistema", oficinaId: 1 }, getJwtSecret());
    const response = await request(app).get("/api/admin/oficinas").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it("returns 404 for the public PDF of an unknown short link", async () => {
    const response = await request(app).get("/api/s/NAOEXISTE/pdf");

    expect(response.status).toBe(404);
  });
});
