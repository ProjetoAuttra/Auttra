import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";
import { criarUsuarioComAcesso, removerUsuario } from "./sessao.js";

const suffix = Date.now();

// Auditoria UX B: o perfil Mecânico abre O.S. mas não tem o módulo de funcionários,
// então a lista de responsáveis vem de /ordens/responsaveis.
describe.skipIf(!process.env.DATABASE_URL)("responsáveis da O.S.", () => {
  let cidadeId: number;
  let oficinaId: number;
  let outraOficinaId: number;
  let usuarioId: number;
  const token = (permissoes: Record<string, string[]>) =>
    "Bearer " +
    jwt.sign(
      { id: usuarioId, email: "m@example.com", nome: "Mecânico", tipo: "funcionario", oficinaId, permissoes },
      getJwtSecret(),
      { expiresIn: "5m" }
    );

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Resp ${suffix}`, uf: "SP" } })).id;
    const mk = async (n: string) =>
      (
        await prisma.oficina.create({
          data: { nome: `Oficina Resp ${n} ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId },
        })
      ).id;
    oficinaId = await mk("A");
    outraOficinaId = await mk("B");
    usuarioId = await criarUsuarioComAcesso([oficinaId], "resp");
    await prisma.funcionario.createMany({
      data: [
        { nome: `Bruno ${suffix}`, cargo: "mecanico", data_contratacao: new Date(), oficina_id: oficinaId },
        { nome: `Ana ${suffix}`, cargo: "mecanico", data_contratacao: new Date(), oficina_id: oficinaId },
        { nome: `Demitido ${suffix}`, cargo: "mecanico", data_contratacao: new Date(), oficina_id: oficinaId, deleted_at: new Date() },
        { nome: `Outra ${suffix}`, cargo: "mecanico", data_contratacao: new Date(), oficina_id: outraOficinaId },
      ],
    });
  });

  afterAll(async () => {
    await prisma.funcionario.deleteMany({ where: { oficina_id: { in: [oficinaId, outraOficinaId] } } });
    await removerUsuario(usuarioId);
    await prisma.oficina.deleteMany({ where: { id: { in: [oficinaId, outraOficinaId] } } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  it("lista id e nome dos funcionários ativos da oficina para quem tem o módulo de ordens", async () => {
    const auth = token({ ordens: ["read", "create", "update"] });
    const r = await request(app).get("/api/ordens/responsaveis").set("Authorization", auth);
    expect(r.status).toBe(200);
    expect(r.body).toEqual([
      { id: expect.any(Number), nome: `Ana ${suffix}` },
      { id: expect.any(Number), nome: `Bruno ${suffix}` },
    ]);

    const semFuncionarios = await request(app).get("/api/funcionarios").set("Authorization", auth);
    expect(semFuncionarios.status).toBe(403);
  });

  it("recusa quem não tem o módulo de ordens", async () => {
    const r = await request(app).get("/api/ordens/responsaveis").set("Authorization", token({ agenda: ["read"] }));
    expect(r.status).toBe(403);
  });
});
