import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Nenhum teste dispara e-mail de verdade; o envio "funciona" e o link vem na resposta.
vi.mock("../src/services/email.service.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/services/email.service.js")>()),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";
import { limparCacheSessoes } from "../src/services/sessao.service.js";
import { ADMIN_COOKIE } from "../src/utils/adminCookie.js";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const email = (tag: string) => `painel-${tag}-${suffix}@example.com`;
const SENHA_FORTE = "Forte@1234";

describe.skipIf(!process.env.DATABASE_URL)("painel admin", () => {
  const usuariosCriados: number[] = [];
  const oficinasCriadas: number[] = [];
  let adminId: number;

  async function criarAdmin(tag: string) {
    const u = await prisma.usuario.create({
      data: { nome: `Admin ${tag}`, email: email(tag), senha: await bcrypt.hash(SENHA_FORTE, 10), tipo: "sistema" },
    });
    usuariosCriados.push(u.id);
    return u;
  }

  const cookieDe = (u: { id: number; email: string; nome: string; token_version: number }) =>
    `${ADMIN_COOKIE}=${jwt.sign({ id: u.id, email: u.email, nome: u.nome, tipo: "sistema", tv: u.token_version }, getJwtSecret(), { expiresIn: "5m" })}`;

  function cookieDaResposta(res: request.Response) {
    const header = ([] as string[]).concat(res.headers["set-cookie"] ?? []).find((c) => c.startsWith(`${ADMIN_COOKIE}=`));
    return header?.split(";")[0];
  }

  // Token cru de um link (a resposta traz ?token=...); o banco guarda só o hash.
  const tokenDoLink = (url: string) => new URL(url).searchParams.get("token")!;

  beforeAll(async () => {
    adminId = (await criarAdmin("ator")).id;
  });

  beforeEach(() => limparCacheSessoes());

  afterAll(async () => {
    for (const id of oficinasCriadas) {
      await prisma.admin_audit_log.deleteMany({ where: { oficina_id: id } });
      await prisma.oficina.update({ where: { id }, data: { gestor_usuario_id: null } });
      await prisma.usuario_oficina.deleteMany({ where: { oficina_id: id } });
      await prisma.perfil_acesso.deleteMany({ where: { oficina_id: id } });
      await prisma.oficina.delete({ where: { id } });
    }
    await prisma.admin_audit_log.deleteMany({
      where: { OR: [{ actor_id: { in: usuariosCriados } }, { entity_type: "usuario", entity_id: { in: usuariosCriados } }] },
    });
    await prisma.usuario_oficina.deleteMany({ where: { usuario_id: { in: usuariosCriados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCriados } } });
  });

  async function adminAtual() {
    return prisma.usuario.findUniqueOrThrow({ where: { id: adminId } });
  }

  describe("sessão", () => {
    it("login grava a sessão em cookie httpOnly e não devolve o token no corpo", async () => {
      const res = await request(app).post("/api/admin/auth/login").send({ email: email("ator"), senha: SENHA_FORTE });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeUndefined();
      const header = ([] as string[]).concat(res.headers["set-cookie"] ?? []).join(";");
      expect(header).toMatch(/HttpOnly/i);
      expect(header).toMatch(/SameSite=Strict/i);
    });

    it("usuário desativado perde o acesso na hora, mesmo com o token ainda válido", async () => {
      const outro = await criarAdmin("desativado");
      const cookie = cookieDe(outro);
      expect((await request(app).get("/api/admin/auth/me").set("Cookie", cookie)).status).toBe(200);

      await prisma.usuario.update({ where: { id: outro.id }, data: { status: "inativo" } });
      limparCacheSessoes();

      expect((await request(app).get("/api/admin/auth/me").set("Cookie", cookie)).status).toBe(401);
    });

    it("trocar a senha derruba as outras sessões e renova o cookie da sessão atual", async () => {
      const outro = await criarAdmin("troca");
      const antigo = cookieDe(outro);

      const res = await request(app)
        .post("/api/admin/auth/senha")
        .set("Cookie", antigo)
        .send({ senha_atual: SENHA_FORTE, nova_senha: "Nova@5678x" });
      expect(res.status).toBe(200);
      const novo = cookieDaResposta(res);
      expect(novo).toBeTruthy();
      limparCacheSessoes();

      expect((await request(app).get("/api/admin/auth/me").set("Cookie", antigo)).status).toBe(401);
      expect((await request(app).get("/api/admin/auth/me").set("Cookie", novo!)).status).toBe(200);
    });

    it("recusa senha fraca na troca", async () => {
      const res = await request(app)
        .post("/api/admin/auth/senha")
        .set("Cookie", cookieDe(await adminAtual()))
        .send({ senha_atual: SENHA_FORTE, nova_senha: "fraca123" });
      expect(res.status).toBe(400);
    });
  });

  describe("usuários do painel", () => {
    it("cria sem senha e devolve um convite que aponta para o admin", async () => {
      const res = await request(app)
        .post("/api/admin/admins")
        .set("Cookie", cookieDe(await adminAtual()))
        .send({ nome: "Novo Painel", email: email("novo") });

      expect(res.status).toBe(201);
      usuariosCriados.push(res.body.usuario.id);
      expect(res.body.convite.reset_url).toContain("/redefinir-senha?token=");
      expect(res.body.convite.reset_url.startsWith(process.env.ADMIN_URL_BASE?.trim() || "http://localhost:8081")).toBe(true);
      const dias = (new Date(res.body.convite.expires_at).getTime() - Date.now()) / 86_400_000;
      expect(dias).toBeGreaterThan(6);
    });

    it("edita nome e e-mail e recusa e-mail já usado", async () => {
      const outro = await criarAdmin("editar");
      const cookie = cookieDe(await adminAtual());

      const ok = await request(app).patch(`/api/admin/admins/${outro.id}`).set("Cookie", cookie)
        .send({ nome: "Nome Novo", email: email("editado") });
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ nome: "Nome Novo", email: email("editado") });

      const repetido = await request(app).patch(`/api/admin/admins/${outro.id}`).set("Cookie", cookie)
        .send({ nome: "Nome Novo", email: email("ator") });
      expect(repetido.status).toBe(400);
    });

    it("link de senha de usuário do painel exige senha forte ao ser usado", async () => {
      const outro = await criarAdmin("link");
      const link = await request(app).post(`/api/admin/admins/${outro.id}/link-senha`).set("Cookie", cookieDe(await adminAtual()));
      expect(link.status).toBe(200);
      const token = tokenDoLink(link.body.reset_url);

      const fraca = await request(app).post("/api/auth/reset-password").send({ token, nova_senha: "fraca123" });
      expect(fraca.status).toBe(400);

      const forte = await request(app).post("/api/auth/reset-password").send({ token, nova_senha: "Outra@9876" });
      expect(forte.status).toBe(200);
      const salvo = await prisma.usuario.findUniqueOrThrow({ where: { id: outro.id } });
      expect(await bcrypt.compare("Outra@9876", salvo.senha)).toBe(true);
    });
  });

  describe("oficinas", () => {
    const dadosOficina = (tag: string) => ({
      nome: `Oficina Painel ${tag} ${suffix}`, logradouro: "Rua A", numero: "1", cep: "01001-000", cidade: "Sao Paulo", uf: "SP",
    });

    async function criarOficina(tag: string, gestorEmail: string) {
      const res = await request(app).post("/api/admin/oficinas").set("Cookie", cookieDe(await adminAtual()))
        .send({ oficina: dadosOficina(tag), gestor: { nome: "Gestor", email: gestorEmail } });
      expect(res.status).toBe(201);
      oficinasCriadas.push(res.body.oficina.id);
      if (!usuariosCriados.includes(res.body.usuario.id)) usuariosCriados.push(res.body.usuario.id);
      return res.body;
    }

    it("gestor novo recebe convite para o app das oficinas", async () => {
      const body = await criarOficina("convite", email("gestor-novo"));
      expect(body.convite.reset_url).toContain("/redefinir-senha?token=");
      expect(body.convite.reset_url.startsWith(process.env.ADMIN_URL_BASE?.trim() || "http://localhost:8081")).toBe(false);
    });

    it("gestor que já tem conta mantém a senha e não recebe convite", async () => {
      const existente = await prisma.usuario.create({
        data: { nome: "Gestor Antigo", email: email("gestor-antigo"), senha: await bcrypt.hash("senhaAntiga1", 10), tipo: "gestoroficina" },
      });
      usuariosCriados.push(existente.id);

      const body = await criarOficina("existente", existente.email);
      expect(body.convite).toBeNull();
      const salvo = await prisma.usuario.findUniqueOrThrow({ where: { id: existente.id } });
      expect(await bcrypt.compare("senhaAntiga1", salvo.senha)).toBe(true);
    });

    it("status é só ativa/inativa: desativar move a oficina para o filtro de inativas", async () => {
      const body = await criarOficina("status", email("gestor-status"));
      const cookie = cookieDe(await adminAtual());
      const id = body.oficina.id;
      const nome = dadosOficina("status").nome;
      const busca = (status: string) =>
        request(app).get("/api/admin/oficinas").set("Cookie", cookie).query({ status, q: nome });

      const ativas = await busca("ativas");
      expect(ativas.body.data.map((o: any) => o.id)).toContain(id);
      expect(ativas.body.data[0]).not.toHaveProperty("status_admin");

      expect((await request(app).delete(`/api/admin/oficinas/${id}`).set("Cookie", cookie)).status).toBe(204);
      expect((await busca("ativas")).body.data.map((o: any) => o.id)).not.toContain(id);
      expect((await busca("inativas")).body.data.map((o: any) => o.id)).toContain(id);
    });

    it("recusa os dados inválidos do formulário (CNPJ zerado, CEP e telefone gigantes, UF inexistente)", async () => {
      const cookie = cookieDe(await adminAtual());
      const enviar = (oficina: Record<string, unknown>) =>
        request(app).post("/api/admin/oficinas").set("Cookie", cookie)
          .send({ oficina: { ...dadosOficina("invalida"), ...oficina }, gestor: { nome: "Gestor", email: email("gestor-invalida") } });

      expect((await enviar({ cnpj: "00000000000000000000000000000" })).body.message).toBe("CNPJ inválido.");
      expect((await enviar({ cep: "000000000000000000000000" })).body.message).toBe("CEP deve ter 8 dígitos.");
      expect((await enviar({ telefone: "1199999999999999" })).body.message).toMatch(/^Telefone deve ter 10 ou 11/);
      expect((await enviar({ uf: "XX" })).body.message).toBe("UF inválida.");
      expect((await enviar({ nome: "x".repeat(121) })).status).toBe(400);
      expect(await prisma.oficina.count({ where: { nome: dadosOficina("invalida").nome } })).toBe(0);
    });

    it("grava CNPJ, CEP e telefone só com dígitos, como o app das oficinas", async () => {
      const cookie = cookieDe(await adminAtual());
      const res = await request(app).post("/api/admin/oficinas").set("Cookie", cookie).send({
        oficina: { ...dadosOficina("digitos"), cnpj: "11.222.333/0001-81", cep: "01001-000", telefone: "(11) 99999-9999" },
        gestor: { nome: "Gestor", email: email("gestor-digitos") },
      });
      expect(res.status).toBe(201);
      oficinasCriadas.push(res.body.oficina.id);
      usuariosCriados.push(res.body.usuario.id);

      const salva = await prisma.oficina.findUniqueOrThrow({ where: { id: res.body.oficina.id } });
      expect(salva).toMatchObject({ cnpj: "11222333000181", cep: "01001000", telefone: "11999999999" });

      const duplicado = await request(app).patch(`/api/admin/oficinas/${oficinasCriadas[0]}`).set("Cookie", cookie)
        .send({ cnpj: "11222333000181" });
      expect(duplicado.status).toBe(400);
      expect(duplicado.body.message).toBe("Já existe uma oficina com este CNPJ.");
    });

    it("não sobrescreve uma oficina ativa com o mesmo nome", async () => {
      const original = await criarOficina("nome-unico", email("gestor-nome-1"));
      const res = await request(app).post("/api/admin/oficinas").set("Cookie", cookieDe(await adminAtual()))
        .send({ oficina: { ...dadosOficina("nome-unico"), logradouro: "Rua Sobrescrita" }, gestor: { nome: "Outro", email: email("gestor-nome-2") } });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Já existe uma oficina com este nome.");
      const salva = await prisma.oficina.findUniqueOrThrow({ where: { id: original.oficina.id } });
      expect(salva.logradouro).toBe("Rua A");
    });

    it("edita uma oficina cujo gestor é usuário do painel sem reenviar o gestor", async () => {
      const body = await criarOficina("gestor-painel", email("gestor-painel"));
      await prisma.oficina.update({ where: { id: body.oficina.id }, data: { gestor_usuario_id: adminId } });

      const res = await request(app).patch(`/api/admin/oficinas/${body.oficina.id}`).set("Cookie", cookieDe(await adminAtual()))
        .send({ telefone: "1133334444" });
      expect(res.status).toBe(200);
      const salva = await prisma.oficina.findUniqueOrThrow({ where: { id: body.oficina.id } });
      expect(salva).toMatchObject({ telefone: "1133334444", gestor_usuario_id: adminId });
    });

    it("grava dados da empresa e do proprietário no cadastro", async () => {
      const res = await request(app).post("/api/admin/oficinas").set("Cookie", cookieDe(await adminAtual())).send({
        oficina: {
          ...dadosOficina("empresa"), razao_social: "Oficina Empresa LTDA", inscricao_estadual: "110.042.490.114",
          whatsapp: "(11) 98888-7777", bairro: "Sé",
        },
        gestor: {
          nome: "Dono Empresa", email: email("dono-empresa"), cpf: "529.982.247-25", telefone: "(11) 97777-6666", data_nascimento: "1985-04-12",
        },
      });
      expect(res.status).toBe(201);
      oficinasCriadas.push(res.body.oficina.id);
      usuariosCriados.push(res.body.usuario.id);

      const detalhe = await request(app).get(`/api/admin/oficinas/${res.body.oficina.id}`).set("Cookie", cookieDe(await adminAtual()));
      expect(detalhe.body).toMatchObject({
        razao_social: "Oficina Empresa LTDA", inscricao_estadual: "110.042.490.114", whatsapp: "11988887777", bairro: "Sé",
        gestor: { nome: "Dono Empresa", cpf: "52998224725", telefone: "11977776666" },
      });
      expect(detalhe.body.gestor.data_nascimento).toMatch(/^1985-04-12/);
    });

    it("recusa CPF, nascimento e inscrição estadual inválidos", async () => {
      const cookie = cookieDe(await adminAtual());
      const enviar = (oficina: Record<string, unknown>, gestor: Record<string, unknown>) =>
        request(app).post("/api/admin/oficinas").set("Cookie", cookie).send({
          oficina: { ...dadosOficina("dono-invalido"), ...oficina },
          gestor: { nome: "Dono", email: email("dono-invalido"), ...gestor },
        });

      expect((await enviar({}, { cpf: "111.111.111-11" })).body.message).toBe("CPF inválido.");
      expect((await enviar({}, { data_nascimento: "2999-01-01" })).body.message).toBe("Data de nascimento inválida.");
      expect((await enviar({}, { data_nascimento: "1990-02-30" })).body.message).toBe("Data de nascimento inválida.");
      expect((await enviar({ inscricao_estadual: "abc" }, {})).body.message).toMatch(/^Inscrição estadual inválida/);
      expect(await prisma.oficina.count({ where: { nome: dadosOficina("dono-invalido").nome } })).toBe(0);
    });

    it("edita os dados do proprietário e troca para outro usuário da oficina", async () => {
      const body = await criarOficina("troca-dono", email("dono-original"));
      const oficinaId = body.oficina.id;
      const cookie = cookieDe(await adminAtual());
      const patch = (dados: Record<string, unknown>) =>
        request(app).patch(`/api/admin/oficinas/${oficinaId}/proprietario`).set("Cookie", cookie).send(dados);

      const editado = await patch({ usuario_id: body.usuario.id, nome: "Dono Editado", email: email("dono-editado"), cpf: "52998224725" });
      expect(editado.status).toBe(200);
      expect(editado.body).toMatchObject({ nome: "Dono Editado", email: email("dono-editado"), cpf: "52998224725" });

      const outro = await prisma.usuario.create({ data: { nome: "Sócio", email: email("socio"), senha: "x", tipo: "funcionario" } });
      usuariosCriados.push(outro.id);
      await prisma.usuario_oficina.create({ data: { usuario_id: outro.id, oficina_id: oficinaId, perfil: "funcionario", status: "ativo" } });

      expect((await patch({ usuario_id: outro.id, nome: "Sócio", email: email("socio") })).status).toBe(200);
      expect((await prisma.oficina.findUniqueOrThrow({ where: { id: oficinaId } })).gestor_usuario_id).toBe(outro.id);
    });

    it("não aceita como proprietário usuário do painel, sem acesso à oficina ou com e-mail de outro", async () => {
      const body = await criarOficina("dono-recusado", email("dono-recusado"));
      const cookie = cookieDe(await adminAtual());
      const patch = (dados: Record<string, unknown>) =>
        request(app).patch(`/api/admin/oficinas/${body.oficina.id}/proprietario`).set("Cookie", cookie).send(dados);

      const semAcesso = await prisma.usuario.create({ data: { nome: "Estranho", email: email("estranho"), senha: "x" } });
      usuariosCriados.push(semAcesso.id);

      expect((await patch({ usuario_id: adminId, nome: "Admin", email: email("ator") })).body.message).toBe("Proprietário inválido para esta oficina.");
      expect((await patch({ usuario_id: semAcesso.id, nome: "Estranho", email: email("estranho") })).status).toBe(400);
      expect((await patch({ usuario_id: body.usuario.id, nome: "Dono", email: email("ator") })).body.message).toBe("E-mail já está em uso por outro usuário.");
    });
  });
});
