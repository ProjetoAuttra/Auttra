import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";
import { criarUsuarioComAcesso, removerUsuario } from "./sessao.js";
import type { PermissionsMap } from "../src/permissions/accessProfiles.js";

const suffix = Date.now();

describe("configuracoes operacionais (agenda/financeiro)", () => {
  let oficinaId: number;
  let token: string;
  let usuarioId: number;

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
    usuarioId = await criarUsuarioComAcesso([oficinaId], "config");

    const permissoes: PermissionsMap = { configuracoes: ["read", "update"] };
    token = jwt.sign(
      {
        id: usuarioId,
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
    await removerUsuario(usuarioId);
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
        id: usuarioId,
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

  describe("orçamentos e OS (documentos)", () => {
    const semPermissao = () =>
      jwt.sign(
        { id: usuarioId, email: "mecanico@example.com", nome: "Mecanico", tipo: "funcionario", oficinaId, permissoes: {} as PermissionsMap },
        getJwtSecret(),
        { expiresIn: "5m" }
      );

    it("vem com 90 dias de garantia e 7 de validade antes de qualquer gravação", async () => {
      const response = await request(app).get("/api/configuracoes/documentos").set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ garantiaDias: 90, validadeOrcamentoDias: 7, observacoes: "" });
    });

    it("grava e devolve o que foi salvo", async () => {
      const novo = { garantiaDias: 180, validadeOrcamentoDias: 15, observacoes: "Veículos não retirados em 30 dias pagam estadia." };
      const put = await request(app).put("/api/configuracoes/documentos").set("Authorization", `Bearer ${token}`).send(novo);
      expect(put.status).toBe(200);
      expect(put.body).toEqual(novo);

      const get = await request(app).get("/api/configuracoes/documentos").set("Authorization", `Bearer ${token}`);
      expect(get.body).toEqual(novo);
    });

    it("recusa garantia menor que a legal (90 dias) sem alterar o que estava salvo", async () => {
      const put = await request(app)
        .put("/api/configuracoes/documentos")
        .set("Authorization", `Bearer ${token}`)
        .send({ garantiaDias: 30, validadeOrcamentoDias: 7, observacoes: "" });
      expect(put.status).toBe(400);
      expect(put.body.code).toBe("GARANTIA_INVALIDA");

      const get = await request(app).get("/api/configuracoes/documentos").set("Authorization", `Bearer ${token}`);
      expect(get.body.garantiaDias).toBe(180);
    });

    it("qualquer usuário da oficina lê (o novo orçamento usa a validade), mas só quem tem permissão grava", async () => {
      const get = await request(app).get("/api/configuracoes/documentos").set("Authorization", `Bearer ${semPermissao()}`);
      expect(get.status).toBe(200);

      const put = await request(app)
        .put("/api/configuracoes/documentos")
        .set("Authorization", `Bearer ${semPermissao()}`)
        .send({ garantiaDias: 365, validadeOrcamentoDias: 7 });
      expect(put.status).toBe(403);
    });
  });
});
