import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";
import { criarUsuarioComAcesso, removerUsuario } from "./sessao.js";

const suffix = Date.now();
const todas = ["read", "create", "update", "delete"];

describe.skipIf(!process.env.DATABASE_URL)("cadastros do estoque", () => {
  let cidadeId: number;
  let oficinaId: number;
  let outraOficinaId: number;
  let usuarioId: number;
  let auth: string;

  const post = (url: string, body: object) => request(app).post(url).set("Authorization", auth).send(body);
  const put = (url: string, body: object) => request(app).put(url).set("Authorization", auth).send(body);

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Estoque ${suffix}`, uf: "SP" } })).id;
    const novaOficina = async (n: string) =>
      (await prisma.oficina.create({ data: { nome: `Oficina Estoque ${n} ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId } })).id;
    oficinaId = await novaOficina("A");
    outraOficinaId = await novaOficina("B");
    usuarioId = await criarUsuarioComAcesso([oficinaId], "estoque", "Gestor Estoque");
    auth =
      "Bearer " +
      jwt.sign(
        { id: usuarioId, email: "g@example.com", nome: "Gestor", tipo: "gestoroficina", oficinaId, permissoes: { estoque: todas, fornecedores: todas } },
        getJwtSecret(),
        { expiresIn: "5m" }
      );
  });

  afterAll(async () => {
    const oficinas = { oficina_id: { in: [oficinaId, outraOficinaId] } };
    await prisma.peca.deleteMany({ where: oficinas });
    await prisma.fornecedor.deleteMany({ where: oficinas });
    await removerUsuario(usuarioId);
    await prisma.oficina.deleteMany({ where: { id: { in: [oficinaId, outraOficinaId] } } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  describe("peças", () => {
    it("cria peça com os campos do formulário", async () => {
      const res = await post("/api/pecas", { nome: `Filtro ${suffix}`, descricao: "Filtro de ar", preco_custo: 20, preco_venda: 40, estoque: 5 });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ nome: `Filtro ${suffix}`, oficina_id: oficinaId, estoque: 5 });
    });

    it("ignora campos que não são do cadastro", async () => {
      const res = await post("/api/pecas", {
        nome: `Intrusa ${suffix}`, preco_custo: 1, preco_venda: 2, estoque: 1,
        id: 999999, deleted_at: "2020-01-01", oficina_id: outraOficinaId,
      });
      expect(res.status).toBe(201);
      expect(res.body.id).not.toBe(999999);
      expect(res.body.deleted_at).toBeNull();
      expect(res.body.oficina_id).toBe(oficinaId);
    });

    it("reativa peça excluída com o mesmo nome", async () => {
      const p = await prisma.peca.create({
        data: { oficina_id: oficinaId, nome: `Velha ${suffix}`, preco_custo: 1, preco_venda: 2, estoque: 3, deleted_at: new Date() },
      });
      const res = await post("/api/pecas", { nome: `Velha ${suffix}`, preco_custo: 5, preco_venda: 9 });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: p.id, deleted_at: null, estoque: 3 });
    });

    // Auditoria V1, B4: o update repassava o body ao Prisma.
    it("editar peça não move a peça para outra oficina nem aceita relações", async () => {
      const p = await prisma.peca.create({ data: { oficina_id: oficinaId, nome: `Mover ${suffix}`, preco_custo: 1, preco_venda: 2 } });
      const res = await put(`/api/pecas/${p.id}`, {
        nome: `Movida ${suffix}`,
        oficina: { connect: { id: outraOficinaId } },
        itens: { create: [] },
        deleted_at: "2020-01-01",
      });
      expect(res.status).toBe(200);
      const depois = await prisma.peca.findUniqueOrThrow({ where: { id: p.id } });
      expect(depois).toMatchObject({ nome: `Movida ${suffix}`, oficina_id: oficinaId, deleted_at: null });
    });

    it("editar peça aceita o formulário e recusa preço negativo", async () => {
      const p = await prisma.peca.create({ data: { oficina_id: oficinaId, nome: `Editar ${suffix}`, preco_custo: 1, preco_venda: 2 } });
      const ok = await put(`/api/pecas/${p.id}`, { nome: `Editada ${suffix}`, descricao: null, preco_custo: 10, preco_venda: 25.5, estoque: 7 });
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ nome: `Editada ${suffix}`, estoque: 7 });
      expect(Number(ok.body.preco_venda)).toBe(25.5);

      const ruim = await put(`/api/pecas/${p.id}`, { preco_venda: -1 });
      expect(ruim.status).toBe(400);
    });
  });

  describe("fornecedores", () => {
    it("cria fornecedor com os campos do formulário", async () => {
      const res = await post("/api/fornecedores", {
        nome: `Auto Peças ${suffix}`, contato: "Rui", telefone: "1140028922", email: "vendas@autopecas.com", cep: "01001000", numero: "10",
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ nome: `Auto Peças ${suffix}`, contato: "Rui", oficina_id: oficinaId });
    });

    it("fornecedor ignora id, deleted_at e oficina de fora", async () => {
      const res = await post("/api/fornecedores", { nome: `Intruso ${suffix}`, id: 999999, deleted_at: "2020-01-01", oficina_id: outraOficinaId });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ deleted_at: null, oficina_id: oficinaId });
      expect(res.body.id).not.toBe(999999);
    });

    // Auditoria V1, B4: o update repassava o body ao Prisma.
    it("editar fornecedor não move para outra oficina nem aceita relações", async () => {
      const f = await prisma.fornecedor.create({ data: { oficina_id: oficinaId, nome: `Forn Mover ${suffix}` } });
      const res = await put(`/api/fornecedores/${f.id}`, {
        nome: `Forn Movido ${suffix}`,
        telefone: "",
        oficina: { connect: { id: outraOficinaId } },
        pagamentos: { create: [] },
        deleted_at: "2020-01-01",
      });
      expect(res.status).toBe(200);
      const depois = await prisma.fornecedor.findUniqueOrThrow({ where: { id: f.id } });
      expect(depois).toMatchObject({ nome: `Forn Movido ${suffix}`, telefone: null, oficina_id: oficinaId, deleted_at: null });
    });
  });
});
