import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";
import { criarUsuarioComAcesso, removerUsuario } from "./sessao.js";

const suffix = Date.now();

describe.skipIf(!process.env.DATABASE_URL)("cor principal da oficina", () => {
  let cidadeId: number;
  let oficinaId: number;
  let usuarioId: number;
  let auth: string;
  const patch = (body: object) => request(app).patch("/api/oficinas/minha").set("Authorization", auth).send(body);

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Cor ${suffix}`, uf: "SP" } })).id;
    oficinaId = (
      await prisma.oficina.create({
        data: { nome: `Oficina Cor ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId },
      })
    ).id;
    usuarioId = await criarUsuarioComAcesso([oficinaId], "cor");
    auth =
      "Bearer " +
      jwt.sign(
        { id: usuarioId, email: "g@example.com", nome: "G", tipo: "gestoroficina", oficinaId, permissoes: { configuracoes: ["read", "update"] }, tv: 0 },
        getJwtSecret(),
        { expiresIn: "5m" }
      );
  });

  afterAll(async () => {
    await removerUsuario(usuarioId);
    await prisma.oficina.deleteMany({ where: { id: oficinaId } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  it("começa sem cor (usa o padrão) e salva uma cor válida em minúsculas", async () => {
    expect((await request(app).get("/api/oficinas/minha").set("Authorization", auth)).body.cor_principal).toBeNull();
    const r = await patch({ cor_principal: "#E11D48" });
    expect(r.status).toBe(200);
    expect(r.body.cor_principal).toBe("#e11d48");
  });

  it("rejeita valores que não são #RRGGBB", async () => {
    for (const ruim of ["red", "#fff", "#12345g", "#123456;}</style>"]) {
      const r = await patch({ cor_principal: ruim });
      expect(r.status).toBe(400);
    }
    expect((await request(app).get("/api/oficinas/minha").set("Authorization", auth)).body.cor_principal).toBe("#e11d48");
  });

  it("vazio ou null restaura o padrão", async () => {
    expect((await patch({ cor_principal: null })).body.cor_principal).toBeNull();
    await patch({ cor_principal: "#0f766e" });
    expect((await patch({ cor_principal: "" })).body.cor_principal).toBeNull();
  });

  it("salvar outros campos não mexe na cor", async () => {
    await patch({ cor_principal: "#0f766e" });
    const r = await patch({ telefone: "11999998888" });
    expect(r.body.cor_principal).toBe("#0f766e");
  });
});
