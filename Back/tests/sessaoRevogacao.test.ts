import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";
import { limparCacheSessoes } from "../src/services/sessao.service.js";
import { FuncionariosService } from "../src/services/funcionarios.service.js";
import { criarUsuarioComAcesso, removerUsuario } from "./sessao.js";

const suffix = Date.now();

describe.skipIf(!process.env.DATABASE_URL)("revogação de sessão (JWT)", () => {
  let cidadeId: number;
  let oficinaId: number;
  let usuarioId: number;

  const tokenDe = (extra: Record<string, unknown> = {}, id = usuarioId) =>
    jwt.sign(
      { id, email: "u@example.com", nome: "U", tipo: "gestoroficina", oficinaId, permissoes: { clientes: ["read"], configuracoes: ["read", "update"] }, tv: 0, ...extra },
      getJwtSecret(),
      { expiresIn: "5m" }
    );
  const chamar = (token: string) => request(app).get("/api/clientes").set("Authorization", `Bearer ${token}`);

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Sessao ${suffix}`, uf: "SP" } })).id;
    oficinaId = (
      await prisma.oficina.create({
        data: { nome: `Oficina Sessao ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.funcionario.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.usuario_oficina.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.oficina.deleteMany({ where: { id: oficinaId } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  const novoUsuario = async () => {
    limparCacheSessoes();
    usuarioId = await criarUsuarioComAcesso([oficinaId], "sessao");
    return usuarioId;
  };

  it("aceita um token válido", async () => {
    await novoUsuario();
    expect((await chamar(tokenDe())).status).toBe(200);
    await removerUsuario(usuarioId);
  });

  it("trocar a senha invalida o token antigo e o novo token devolvido funciona", async () => {
    await novoUsuario();
    await prisma.usuario.update({ where: { id: usuarioId }, data: { senha: await bcrypt.hash("antiga123", 10) } });
    const antigo = tokenDe();

    const troca = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${antigo}`)
      .send({ senha_atual: "antiga123", nova_senha: "novaSenha1" });
    expect(troca.status).toBe(200);
    expect(typeof troca.body.token).toBe("string");

    const velho = await chamar(antigo);
    expect(velho.status).toBe(401);
    expect(velho.body.message).toMatch(/^Sessão encerrada/);
    expect((await chamar(troca.body.token)).status).toBe(200);
    await removerUsuario(usuarioId);
  });

  it("usuário desativado ou removido da oficina perde o acesso", async () => {
    await novoUsuario();
    const token = tokenDe();
    expect((await chamar(token)).status).toBe(200);

    await prisma.usuario_oficina.updateMany({ where: { usuario_id: usuarioId }, data: { status: "inativo" } });
    limparCacheSessoes();
    expect((await chamar(token)).status).toBe(401);

    await prisma.usuario_oficina.updateMany({ where: { usuario_id: usuarioId }, data: { status: "ativo" } });
    await prisma.usuario.update({ where: { id: usuarioId }, data: { status: "inativo" } });
    limparCacheSessoes();
    expect((await chamar(token)).status).toBe(401);
    await removerUsuario(usuarioId);
  });

  it("excluir o funcionário derruba a sessão dele", async () => {
    await novoUsuario();
    const funcionario = await prisma.funcionario.create({
      data: { nome: "F", cargo: "mecanico", data_contratacao: new Date(), oficina_id: oficinaId, usuario_id: usuarioId },
    });
    const token = tokenDe();
    expect((await chamar(token)).status).toBe(200);

    await FuncionariosService.delete(funcionario.id, oficinaId);
    expect((await chamar(token)).status).toBe(401);
    await removerUsuario(usuarioId);
  });

  it("tokens de propósito único (seleção de oficina) não autenticam", async () => {
    await novoUsuario();
    expect((await chamar(tokenDe({ purpose: "office-selection" }))).status).toBe(401);
    await removerUsuario(usuarioId);
  });

  it("usuário inexistente é recusado", async () => {
    limparCacheSessoes();
    expect((await chamar(tokenDe({}, 999999999))).status).toBe(401);
  });
});
