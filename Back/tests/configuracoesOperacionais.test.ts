import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";
import type { PermissionsMap } from "../src/permissions/accessProfiles.js";

const suffix = Date.now();

describe("configuracoes operacionais (agenda/financeiro)", () => {
  let oficinaId: number;
  let token: string;

  beforeAll(async () => {
    const cidade = await prisma.cidade.create({
      data: { nome: `Cidade Teste ${suffix}`, uf: "SP" },
    });

    const oficina = await prisma.oficina.create({
      data: {
        nome: `Oficina Teste Config ${suffix}`,
        logradouro: "Rua Teste",
        numero: "100",
        cep: "00000000",
        cidade_id: cidade.id,
      },
    });
    oficinaId = oficina.id;

    const permissoes: PermissionsMap = { configuracoes: ["read", "update"] };
    token = jwt.sign(
      {
        id: 1,
        email: "gestor@example.com",
        nome: "Gestor",
        tipo: "gestoroficina",
        oficinaId,
        permissoes,
      },
      getJwtSecret(),
      { expiresIn: "5m" }
    );
  });

  afterAll(async () => {
    if (oficinaId) {
      await prisma.oficina.delete({ where: { id: oficinaId } }).catch(() => {});
    }
  });

  it("returns default agenda config before any save", async () => {
    const response = await request(app)
      .get("/api/configuracoes/agenda")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      horarioInicio: "08:00",
      horarioFim: "18:00",
    });
  });

  it("persists agenda config and survives a fresh fetch (reload)", async () => {
    const updated = {
      horarioInicio: "07:30",
      horarioFim: "19:00",
      dias: "Segunda a Sexta",
      tempoMedio: "45 minutos",
    };

    const putResponse = await request(app)
      .put("/api/configuracoes/agenda")
      .set("Authorization", `Bearer ${token}`)
      .send(updated);

    expect(putResponse.status).toBe(200);
    expect(putResponse.body).toEqual(updated);

    const getResponse = await request(app)
      .get("/api/configuracoes/agenda")
      .set("Authorization", `Bearer ${token}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual(updated);
  });

  it("persists financeiro config and survives a fresh fetch (reload)", async () => {
    const updated = {
      formasPagamento: "Pix, Boleto",
      emitirRecibos: false,
      jurosAtraso: "5%",
    };

    const putResponse = await request(app)
      .put("/api/configuracoes/financeiro")
      .set("Authorization", `Bearer ${token}`)
      .send(updated);

    expect(putResponse.status).toBe(200);
    expect(putResponse.body).toEqual(updated);

    const getResponse = await request(app)
      .get("/api/configuracoes/financeiro")
      .set("Authorization", `Bearer ${token}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual(updated);
  });

  it("blocks agenda/financeiro config without the configuracoes permission", async () => {
    const readOnlyToken = jwt.sign(
      {
        id: 2,
        email: "mecanico@example.com",
        nome: "Mecanico",
        tipo: "funcionario",
        oficinaId,
        permissoes: {} as PermissionsMap,
      },
      getJwtSecret(),
      { expiresIn: "5m" }
    );

    const response = await request(app)
      .put("/api/configuracoes/agenda")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({ horarioInicio: "06:00" });

    expect(response.status).toBe(403);
  });
});
