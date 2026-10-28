import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";
import { limparCacheSessoes } from "../src/services/sessao.service.js";
import { criarUsuarioComAcesso, removerUsuario } from "./sessao.js";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const PRIVADOS = ["senha", "totp_secret", "token_version", "failed_login_attempts", "locked_until", "last_login_ip", "last_login_user_agent", "cpf", "telefone", "data_nascimento"];

describe.skipIf(!process.env.DATABASE_URL)("usuários no app não expõem dados privados", () => {
  let cidadeId: number;
  let oficinaId: number;
  let usuarioId: number;

  const chamar = (metodo: "get" | "put", url: string) =>
    request(app)[metodo](url).set(
      "Authorization",
      `Bearer ${jwt.sign({ id: usuarioId, email: "u@example.com", nome: "U", tipo: "gestoroficina", oficinaId, permissoes: { funcionarios: ["read", "update"] }, tv: 0 }, getJwtSecret(), { expiresIn: "5m" })}`
    );

  beforeAll(async () => {
    limparCacheSessoes();
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Privacidade ${suffix}`, uf: "SP" } })).id;
    oficinaId = (await prisma.oficina.create({
      data: { nome: `Oficina Privacidade ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId },
    })).id;
    usuarioId = await criarUsuarioComAcesso([oficinaId], "privacidade", "Dono");
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { cpf: "52998224725", telefone: "11999999999", data_nascimento: new Date("1985-01-01"), totp_secret: "SEGREDO" },
    });
  });

  afterAll(async () => {
    await removerUsuario(usuarioId);
    await prisma.oficina.deleteMany({ where: { id: oficinaId } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  it("lista de usuários", async () => {
    const res = await chamar("get", "/api/usuario");
    expect(res.status).toBe(200);
    const proprio = res.body.find((u: any) => u.id === usuarioId);
    expect(proprio).toBeTruthy();
    for (const campo of PRIVADOS) expect(proprio).not.toHaveProperty(campo);
  });

  it("detalhe de um usuário", async () => {
    const res = await chamar("get", `/api/usuario/${usuarioId}`);
    expect(res.status).toBe(200);
    for (const campo of PRIVADOS) expect(res.body).not.toHaveProperty(campo);
  });
});
