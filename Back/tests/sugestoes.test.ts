import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";
import { limparCacheSessoes } from "../src/services/sessao.service.js";
import { ADMIN_COOKIE } from "../src/utils/adminCookie.js";
import { criarUsuarioComAcesso, removerUsuario } from "./sessao.js";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

describe.skipIf(!process.env.DATABASE_URL)("sugestões", () => {
  let cidadeId: number;
  const oficinas: number[] = [];
  const usuarios: number[] = [];
  let adminId: number;

  const tokenApp = (usuarioId: number, oficinaId: number) =>
    jwt.sign({ id: usuarioId, email: "u@example.com", nome: "U", tipo: "gestoroficina", oficinaId, permissoes: {}, tv: 0 }, getJwtSecret(), { expiresIn: "5m" });

  const enviar = (usuarioId: number, oficinaId: number, body: Record<string, unknown>) =>
    request(app).post("/api/sugestoes").set("Authorization", `Bearer ${tokenApp(usuarioId, oficinaId)}`).send(body);

  const listarNoAdmin = (oficinaId: number) =>
    request(app).get(`/api/admin/oficinas/${oficinaId}/sugestoes`)
      .set("Cookie", `${ADMIN_COOKIE}=${jwt.sign({ id: adminId, email: "a@example.com", nome: "A", tipo: "sistema", tv: 0 }, getJwtSecret(), { expiresIn: "5m" })}`);

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Sugestao ${suffix}`, uf: "SP" } })).id;
    for (const n of [1, 2]) {
      oficinas.push((await prisma.oficina.create({
        data: { nome: `Oficina Sugestao ${n} ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId },
      })).id);
    }
    usuarios.push(await criarUsuarioComAcesso([oficinas[0]], "sugestao", "Cliente Um"));
    usuarios.push(await criarUsuarioComAcesso([oficinas[1]], "sugestao", "Cliente Dois"));
    adminId = (await prisma.usuario.create({
      data: { nome: "Admin Sugestao", email: `admin-sugestao-${suffix}@example.com`, senha: "x", tipo: "sistema" },
    })).id;
  });

  beforeEach(() => limparCacheSessoes());

  afterAll(async () => {
    await prisma.sugestao.deleteMany({ where: { oficina_id: { in: oficinas } } });
    for (const id of usuarios) await removerUsuario(id);
    await prisma.usuario.deleteMany({ where: { id: adminId } });
    await prisma.oficina.deleteMany({ where: { id: { in: oficinas } } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  it("cliente envia uma sugestão e ela aparece no cadastro da oficina no admin", async () => {
    const res = await enviar(usuarios[0], oficinas[0], { modulo: "agenda", mensagem: "  Poder arrastar agendamentos entre os dias.  " });
    expect(res.status).toBe(201);

    const lista = await listarNoAdmin(oficinas[0]);
    expect(lista.status).toBe(200);
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0]).toMatchObject({
      modulo: "agenda",
      mensagem: "Poder arrastar agendamentos entre os dias.",
      usuario: { id: usuarios[0], nome: "Cliente Um" },
    });
  });

  it("a oficina vem do token: não dá para mandar sugestão em nome de outra oficina", async () => {
    const res = await enviar(usuarios[1], oficinas[1], { modulo: "outros", mensagem: "Sugestão da oficina dois.", oficina_id: oficinas[0] });
    expect(res.status).toBe(201);

    const daUm = (await listarNoAdmin(oficinas[0])).body.map((s: any) => s.mensagem);
    const daDois = (await listarNoAdmin(oficinas[1])).body.map((s: any) => s.mensagem);
    expect(daUm).not.toContain("Sugestão da oficina dois.");
    expect(daDois).toContain("Sugestão da oficina dois.");
  });

  it("valida módulo e tamanho da mensagem", async () => {
    expect((await enviar(usuarios[0], oficinas[0], { modulo: "inexistente", mensagem: "Texto suficiente aqui." })).body.message)
      .toBe("Selecione o módulo.");
    expect((await enviar(usuarios[0], oficinas[0], { modulo: "agenda", mensagem: "curta" })).status).toBe(400);
    expect((await enviar(usuarios[0], oficinas[0], { modulo: "agenda", mensagem: "x".repeat(2001) })).status).toBe(400);
  });

  it("exige login no app e sessão de admin para listar", async () => {
    expect((await request(app).post("/api/sugestoes").send({ modulo: "agenda", mensagem: "Sem login nenhum aqui." })).status).toBe(401);
    expect((await request(app).get(`/api/admin/oficinas/${oficinas[0]}/sugestoes`)).status).toBe(401);
  });
});
