import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { generateSecret, generateSync } from "otplib";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";
import { limparCacheSessoes } from "../src/services/sessao.service.js";
import { ADMIN_COOKIE } from "../src/utils/adminCookie.js";

// Comportamento atual do login do painel admin (senha + 2FA obrigatório).
// Serve de rede de proteção para mexer no fluxo sem mudar o que ele faz.

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const email = (tag: string) => `auth-${tag}-${suffix}@example.com`;
const SENHA = "Forte@1234";
const AUTH = "/api/admin/auth";

// Cada teste usa um IP próprio para não esbarrar no limite de tentativas de login (20 por IP).
let ultimoIp = 0;
const novoIp = () => `198.51.100.${++ultimoIp}`;

const segredoDoUri = (otpauth: string) => new URL(otpauth).searchParams.get("secret")!;
const codigo = (secret: string) => generateSync({ secret });

function cookieDaResposta(res: request.Response) {
  const header = ([] as string[]).concat(res.headers["set-cookie"] ?? []).find((c) => c.startsWith(`${ADMIN_COOKIE}=`));
  return header?.split(";")[0];
}

describe.skipIf(!process.env.DATABASE_URL)("login do painel admin", () => {
  const usuariosCriados: number[] = [];

  async function criarAdmin(tag: string, totp_secret: string | null = null) {
    const u = await prisma.usuario.create({
      data: { nome: `Admin ${tag}`, email: email(tag), senha: await bcrypt.hash(SENHA, 10), tipo: "sistema", totp_secret },
    });
    usuariosCriados.push(u.id);
    return u;
  }

  const sessaoDe = (u: { id: number; email: string; nome: string; token_version: number }) =>
    `${ADMIN_COOKIE}=${jwt.sign({ id: u.id, email: u.email, nome: u.nome, tipo: "sistema", tv: u.token_version }, getJwtSecret(), { expiresIn: "5m" })}`;

  const post = (path: string, body: object, ip: string, cookie?: string) => {
    const req = request(app).post(`${AUTH}${path}`).set("X-Forwarded-For", ip);
    return (cookie ? req.set("Cookie", cookie) : req).send(body);
  };

  const totpNoBanco = async (id: number) => (await prisma.usuario.findUniqueOrThrow({ where: { id } })).totp_secret;

  beforeEach(() => limparCacheSessoes());

  afterAll(async () => {
    await prisma.admin_audit_log.deleteMany({
      where: { OR: [{ actor_id: { in: usuariosCriados } }, { entity_type: "usuario", entity_id: { in: usuariosCriados } }] },
    });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCriados } } });
  });

  describe("primeiro acesso (sem 2FA)", () => {
    it("senha certa não abre sessão: pede o cadastro do 2FA e devolve o QR code", async () => {
      const u = await criarAdmin("primeiro");
      const res = await post("/login", { email: u.email, senha: SENHA }, novoIp());

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ requires2fa_setup: true });
      expect(res.body.pre_auth_token).toBeTruthy();
      expect(res.body.otpauth).toMatch(/^otpauth:\/\/totp\//);
      expect(cookieDaResposta(res)).toBeUndefined();
      expect(await totpNoBanco(u.id)).toBe(`pending:${segredoDoUri(res.body.otpauth)}`);
    });

    it("logar de novo antes de concluir devolve o mesmo segredo pendente", async () => {
      const u = await criarAdmin("repete");
      const ip = novoIp();
      const a = await post("/login", { email: u.email, senha: SENHA }, ip);
      const b = await post("/login", { email: u.email, senha: SENHA }, ip);

      expect(segredoDoUri(b.body.otpauth)).toBe(segredoDoUri(a.body.otpauth));
    });

    it("código certo ativa o 2FA e grava a sessão em cookie httpOnly, sem token no corpo", async () => {
      const u = await criarAdmin("setup");
      const ip = novoIp();
      const login = await post("/login", { email: u.email, senha: SENHA }, ip);
      const secret = segredoDoUri(login.body.otpauth);

      const res = await post("/2fa/first-setup", { pre_auth_token: login.body.pre_auth_token, code: codigo(secret) }, ip);

      expect(res.status).toBe(200);
      expect(res.body.token).toBeUndefined();
      expect(res.body.usuario).toMatchObject({ id: u.id, email: u.email, tipo: "sistema" });
      const header = ([] as string[]).concat(res.headers["set-cookie"] ?? []).join(";");
      expect(header).toMatch(/HttpOnly/i);
      expect(header).toMatch(/SameSite=Strict/i);
      expect(await totpNoBanco(u.id)).toBe(secret);

      const me = await request(app).get(`${AUTH}/me`).set("Cookie", cookieDaResposta(res)!);
      expect(me.status).toBe(200);
      expect(me.body.usuario).toMatchObject({ id: u.id, totp_enabled: true });
      expect(me.body.usuario.last_login_at).toBeTruthy();
    });

    it("código errado no cadastro não abre sessão e mantém o 2FA pendente", async () => {
      const u = await criarAdmin("setup-errado");
      const ip = novoIp();
      const login = await post("/login", { email: u.email, senha: SENHA }, ip);

      const res = await post("/2fa/first-setup", { pre_auth_token: login.body.pre_auth_token, code: "000000" }, ip);

      expect(res.status).toBe(400);
      expect(cookieDaResposta(res)).toBeUndefined();
      expect(await totpNoBanco(u.id)).toMatch(/^pending:/);
    });
  });

  describe("com 2FA ativo", () => {
    it("senha certa pede o código, sem QR code e sem sessão", async () => {
      const u = await criarAdmin("ativo", generateSecret());
      const res = await post("/login", { email: u.email, senha: SENHA }, novoIp());

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ requires2fa: true });
      expect(res.body.pre_auth_token).toBeTruthy();
      expect(res.body.otpauth).toBeUndefined();
      expect(cookieDaResposta(res)).toBeUndefined();
    });

    it("código certo abre a sessão e zera as tentativas", async () => {
      const secret = generateSecret();
      const u = await criarAdmin("verify", secret);
      await prisma.usuario.update({ where: { id: u.id }, data: { failed_login_attempts: 3 } });
      const ip = novoIp();
      const login = await post("/login", { email: u.email, senha: SENHA }, ip);

      const res = await post("/2fa/verify", { pre_auth_token: login.body.pre_auth_token, code: codigo(secret) }, ip);

      expect(res.status).toBe(200);
      expect(cookieDaResposta(res)).toBeTruthy();
      const depois = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
      expect(depois.failed_login_attempts).toBe(0);
    });

    it("código errado é recusado e conta como tentativa", async () => {
      const u = await criarAdmin("verify-errado", generateSecret());
      const ip = novoIp();
      const login = await post("/login", { email: u.email, senha: SENHA }, ip);

      const res = await post("/2fa/verify", { pre_auth_token: login.body.pre_auth_token, code: "000000" }, ip);

      expect(res.status).toBe(401);
      expect(cookieDaResposta(res)).toBeUndefined();
      const depois = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
      expect(depois.failed_login_attempts).toBe(1);
    });

    it("5 códigos errados bloqueiam a conta", async () => {
      const u = await criarAdmin("verify-bloqueio", generateSecret());
      const ip = novoIp();
      const login = await post("/login", { email: u.email, senha: SENHA }, ip);

      for (let i = 0; i < 5; i++) {
        await post("/2fa/verify", { pre_auth_token: login.body.pre_auth_token, code: "000000" }, ip);
      }

      const depois = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
      expect(depois.locked_until!.getTime()).toBeGreaterThan(Date.now());
      expect((await post("/login", { email: u.email, senha: SENHA }, ip)).status).toBe(423);
    });
  });

  describe("senha e bloqueio", () => {
    it("senha errada e e-mail inexistente recebem a mesma resposta", async () => {
      const u = await criarAdmin("senha-errada");
      const ip = novoIp();
      const errada = await post("/login", { email: u.email, senha: "Errada@123" }, ip);
      const inexistente = await post("/login", { email: email("ninguem"), senha: SENHA }, ip);

      expect(errada.status).toBe(401);
      expect(inexistente.status).toBe(401);
      expect(errada.body).toEqual(inexistente.body);
    });

    it("5 senhas erradas bloqueiam a conta, mesmo para a senha certa", async () => {
      const u = await criarAdmin("bloqueio");
      const ip = novoIp();
      for (let i = 0; i < 5; i++) {
        await post("/login", { email: u.email, senha: "Errada@123" }, ip);
      }

      const res = await post("/login", { email: u.email, senha: SENHA }, ip);
      expect(res.status).toBe(423);
    });

    it("exige e-mail e senha", async () => {
      expect((await post("/login", { email: email("vazio") }, novoIp())).status).toBe(400);
    });
  });

  describe("token temporário do 2FA", () => {
    it("não vale como sessão do painel", async () => {
      const u = await criarAdmin("pre-auth", generateSecret());
      const login = await post("/login", { email: u.email, senha: SENHA }, novoIp());

      const me = await request(app).get(`${AUTH}/me`).set("Cookie", `${ADMIN_COOKIE}=${login.body.pre_auth_token}`);
      expect(me.status).toBe(403);
    });

    it("token de sessão não serve como token temporário", async () => {
      const secret = generateSecret();
      const u = await criarAdmin("troca-token", secret);
      const sessao = jwt.sign({ id: u.id, tipo: "sistema", tv: 0 }, getJwtSecret(), { expiresIn: "5m" });

      const res = await post("/2fa/verify", { pre_auth_token: sessao, code: codigo(secret) }, novoIp());
      expect(res.status).toBe(401);
    });

    it("token expirado é recusado", async () => {
      const secret = generateSecret();
      const u = await criarAdmin("expirado", secret);
      const vencido = jwt.sign({ purpose: "2fa-pending", id: u.id, exp: Math.floor(Date.now() / 1000) - 10 }, getJwtSecret());

      const res = await post("/2fa/verify", { pre_auth_token: vencido, code: codigo(secret) }, novoIp());
      expect(res.status).toBe(401);
    });
  });

  describe("2FA com sessão aberta", () => {
    it("setup recusa quando o 2FA já está ativo", async () => {
      const u = await criarAdmin("setup-ativo", generateSecret());
      const res = await post("/2fa/setup", {}, novoIp(), sessaoDe(u));
      expect(res.status).toBe(400);
    });

    it("setup + confirm ativam o 2FA", async () => {
      const u = await criarAdmin("confirm");
      const ip = novoIp();
      const setup = await post("/2fa/setup", {}, ip, sessaoDe(u));
      expect(setup.status).toBe(200);
      expect(await totpNoBanco(u.id)).toBe(`pending:${setup.body.secret}`);

      expect((await post("/2fa/confirm", { code: "000000" }, ip, sessaoDe(u))).status).toBe(400);
      const res = await post("/2fa/confirm", { code: codigo(setup.body.secret) }, ip, sessaoDe(u));

      expect(res.status).toBe(200);
      expect(await totpNoBanco(u.id)).toBe(setup.body.secret);
    });

    it("desativar exige um código válido", async () => {
      const secret = generateSecret();
      const u = await criarAdmin("disable", secret);
      const ip = novoIp();

      const errado = await request(app).delete(`${AUTH}/2fa`).set("X-Forwarded-For", ip).set("Cookie", sessaoDe(u)).send({ code: "000000" });
      expect(errado.status).toBe(400);
      expect(await totpNoBanco(u.id)).toBe(secret);

      const certo = await request(app).delete(`${AUTH}/2fa`).set("X-Forwarded-For", ip).set("Cookie", sessaoDe(u)).send({ code: codigo(secret) });
      expect(certo.status).toBe(200);
      expect(await totpNoBanco(u.id)).toBeNull();
    });

    it("rotas autenticadas recusam quem não tem sessão", async () => {
      expect((await request(app).get(`${AUTH}/me`)).status).toBe(401);
      expect((await post("/2fa/setup", {}, novoIp())).status).toBe(401);
    });
  });

  describe("proteções contra tentativa e erro", () => {
    const del2fa = (body: object, ip: string, cookie: string) =>
      request(app).delete(`${AUTH}/2fa`).set("X-Forwarded-For", ip).set("Cookie", cookie).send(body);

    it("desativar o 2FA trava após 5 códigos errados, mesmo com o código certo e outro IP", async () => {
      const secret = generateSecret();
      const u = await criarAdmin("disable-limite", secret);
      for (let i = 0; i < 5; i++) {
        expect((await del2fa({ code: "000000" }, novoIp(), sessaoDe(u))).status).toBe(400);
      }

      const res = await del2fa({ code: codigo(secret) }, novoIp(), sessaoDe(u));
      expect(res.status).toBe(429);
      expect(await totpNoBanco(u.id)).toBe(secret);
    });

    it("confirmar o 2FA trava após 5 códigos errados", async () => {
      const u = await criarAdmin("confirm-limite");
      const setup = await post("/2fa/setup", {}, novoIp(), sessaoDe(u));
      for (let i = 0; i < 5; i++) {
        await post("/2fa/confirm", { code: "000000" }, novoIp(), sessaoDe(u));
      }

      const res = await post("/2fa/confirm", { code: codigo(setup.body.secret) }, novoIp(), sessaoDe(u));
      expect(res.status).toBe(429);
    });

    it("trocar a senha trava após 5 senhas atuais erradas", async () => {
      const u = await criarAdmin("senha-limite");
      for (let i = 0; i < 5; i++) {
        await post("/senha", { senha_atual: "Errada@123", nova_senha: "Nova@5678x" }, novoIp(), sessaoDe(u));
      }

      const res = await post("/senha", { senha_atual: SENHA, nova_senha: "Nova@5678x" }, novoIp(), sessaoDe(u));
      expect(res.status).toBe(429);
    });

    it("o limite é por usuário: o erro de um admin não trava outro", async () => {
      const a = await criarAdmin("limite-a", generateSecret());
      const secretB = generateSecret();
      const b = await criarAdmin("limite-b", secretB);
      for (let i = 0; i < 5; i++) await del2fa({ code: "000000" }, novoIp(), sessaoDe(a));

      expect((await del2fa({ code: codigo(secretB) }, novoIp(), sessaoDe(b))).status).toBe(200);
    });

    it("tentativas simultâneas de senha errada contam todas", async () => {
      const u = await criarAdmin("simultaneo");
      await Promise.all(
        Array.from({ length: 5 }, () => post("/login", { email: u.email, senha: "Errada@123" }, novoIp()))
      );

      const depois = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
      expect(depois.failed_login_attempts).toBe(5);
      expect(depois.locked_until!.getTime()).toBeGreaterThan(Date.now());
    });

    it("código errado no primeiro cadastro do 2FA conta como tentativa", async () => {
      const u = await criarAdmin("setup-conta");
      const ip = novoIp();
      const login = await post("/login", { email: u.email, senha: SENHA }, ip);
      await post("/2fa/first-setup", { pre_auth_token: login.body.pre_auth_token, code: "000000" }, ip);

      const depois = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
      expect(depois.failed_login_attempts).toBe(1);
    });
  });

  describe("tolerância do código", () => {
    // Código do intervalo anterior (30 s atrás): quem digita na virada não deve ser recusado.
    const codigoAnterior = (secret: string) => generateSync({ secret, epoch: Math.floor(Date.now() / 1000) - 30 });

    it("confirmar aceita o código do intervalo anterior, como o login", async () => {
      const u = await criarAdmin("tolerancia-confirm");
      const setup = await post("/2fa/setup", {}, novoIp(), sessaoDe(u));

      const res = await post("/2fa/confirm", { code: codigoAnterior(setup.body.secret) }, novoIp(), sessaoDe(u));
      expect(res.status).toBe(200);
    });

    it("desativar aceita o código do intervalo anterior, como o login", async () => {
      const secret = generateSecret();
      const u = await criarAdmin("tolerancia-disable", secret);

      const res = await request(app)
        .delete(`${AUTH}/2fa`).set("X-Forwarded-For", novoIp()).set("Cookie", sessaoDe(u))
        .send({ code: codigoAnterior(secret) });
      expect(res.status).toBe(200);
    });
  });

  it("logout apaga o cookie", async () => {
    const res = await post("/logout", {}, novoIp());
    expect(res.status).toBe(204);
    expect(([] as string[]).concat(res.headers["set-cookie"] ?? []).join(";")).toMatch(new RegExp(`${ADMIN_COOKIE}=;`));
  });
});
