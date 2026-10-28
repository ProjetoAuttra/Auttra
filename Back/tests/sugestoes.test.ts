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

  describe("lista geral no painel admin", () => {
    // Marcador no texto isola estas sugestoes de qualquer outra que exista no banco.
    const marca = `lista-${suffix}`;
    const listar = (query: Record<string, string | number>) =>
      request(app).get("/api/admin/sugestoes")
        .set("Cookie", `${ADMIN_COOKIE}=${jwt.sign({ id: adminId, email: "a@example.com", nome: "A", tipo: "sistema", tv: 0 }, getJwtSecret(), { expiresIn: "5m" })}`)
        .query({ q: marca, ...query });
    const textos = (res: request.Response) => res.body.data.map((s: any) => s.mensagem.replace(` ${marca}`, ""));

    beforeAll(async () => {
      const criar = (oficina: number, usuario: number, modulo: any, texto: string, quando: string) =>
        prisma.sugestao.create({ data: { oficina_id: oficina, usuario_id: usuario, modulo, mensagem: `${texto} ${marca}`, created_at: new Date(quando) } });
      await criar(oficinas[0], usuarios[0], "agenda", "A", "2026-01-05T15:00:00Z");
      await criar(oficinas[1], usuarios[1], "estoque", "B", "2026-01-08T15:00:00Z");
      // 23h do dia 09/01 em Brasilia = 02h do dia 10/01 em UTC
      await criar(oficinas[0], usuarios[0], "agenda", "C", "2026-01-10T02:00:00Z");
      await criar(oficinas[1], usuarios[1], "outros", "D", "2026-01-12T15:00:00Z");
    });

    it("traz todas as oficinas, da mais recente para a mais antiga por padrão", async () => {
      const res = await listar({});
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(4);
      expect(textos(res)).toEqual(["D", "C", "B", "A"]);
      expect(res.body.data[0]).toMatchObject({ oficina: { id: oficinas[1] }, usuario: { nome: "Cliente Dois" } });
    });

    it("inverte a ordem e pagina sem repetir itens", async () => {
      expect(textos(await listar({ ordem: "asc" }))).toEqual(["A", "B", "C", "D"]);
      const p1 = await listar({ pageSize: 3, page: 1 });
      const p2 = await listar({ pageSize: 3, page: 2 });
      expect(textos(p1)).toEqual(["D", "C", "B"]);
      expect(textos(p2)).toEqual(["A"]);
      expect(p2.body.total).toBe(4);
    });

    it("filtra por módulo e por oficina", async () => {
      expect(textos(await listar({ modulo: "agenda" }))).toEqual(["C", "A"]);
      expect(textos(await listar({ oficina_id: oficinas[1] }))).toEqual(["D", "B"]);
    });

    it("filtra por período no horário de Brasília, com o último dia inteiro", async () => {
      expect(textos(await listar({ de: "2026-01-08", ate: "2026-01-09" }))).toEqual(["C", "B"]);
      expect(textos(await listar({ de: "2026-01-10" }))).toEqual(["D"]);
      expect(textos(await listar({ ate: "2026-01-05" }))).toEqual(["A"]);
    });

    it("busca no texto, no nome da oficina e em quem enviou", async () => {
      const busca = (q: string) => request(app).get("/api/admin/sugestoes")
        .set("Cookie", `${ADMIN_COOKIE}=${jwt.sign({ id: adminId, email: "a@example.com", nome: "A", tipo: "sistema", tv: 0 }, getJwtSecret(), { expiresIn: "5m" })}`)
        .query({ q, de: "2026-01-01", ate: "2026-01-31" });
      expect((await busca(`B ${marca}`)).body.data.map((s: any) => s.mensagem)).toEqual([`B ${marca}`]);
      expect((await busca(`Oficina Sugestao 2 ${suffix}`)).body.total).toBeGreaterThanOrEqual(2);
      expect((await busca("Cliente Dois")).body.data.every((s: any) => s.usuario.nome === "Cliente Dois")).toBe(true);
    });

    it("recusa filtros inválidos e exige sessão de admin", async () => {
      expect((await listar({ de: "2026-13-40" })).status).toBe(400);
      expect((await listar({ de: "2026-01-10", ate: "2026-01-01" })).body.message).toBe("A data inicial deve ser anterior à final.");
      expect((await listar({ modulo: "inexistente" })).body.message).toBe("Módulo inválido.");
      expect((await request(app).get("/api/admin/sugestoes")).status).toBe(401);
    });
  });
});
