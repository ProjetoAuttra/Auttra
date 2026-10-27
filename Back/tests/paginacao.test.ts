import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";

const suffix = Date.now();
const todas = ["read", "create", "update", "delete"];

describe.skipIf(!process.env.DATABASE_URL)("paginação das listagens", () => {
  let cidadeId: number;
  let oficinaId: number;
  let usuarioId: number;
  let clienteId: number;
  let auth: string;
  const get = (url: string) => request(app).get(url).set("Authorization", auth);

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Pag ${suffix}`, uf: "SP" } })).id;
    oficinaId = (
      await prisma.oficina.create({
        data: { nome: `Oficina Pag ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId },
      })
    ).id;
    usuarioId = (await prisma.usuario.create({ data: { email: `pag-${suffix}@example.com`, senha: "x", nome: "Gestor" } })).id;
    auth =
      "Bearer " +
      jwt.sign(
        {
          id: usuarioId, email: "g@example.com", nome: "Gestor", tipo: "gestoroficina", oficinaId,
          permissoes: { clientes: todas, estoque: todas, servicos: todas, financeiro: todas, orcamentos: todas, ordens: todas, veiculos: todas },
        },
        getJwtSecret(),
        { expiresIn: "5m" }
      );

    await prisma.cliente.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({ nome: `Cliente ${String(i).padStart(2, "0")} ${suffix}`, oficina_id: oficinaId })),
    });
    clienteId = (await prisma.cliente.findFirstOrThrow({ where: { oficina_id: oficinaId } })).id;
    await prisma.peca.createMany({
      data: [5, 1, 9, 2].map((estoque, i) => ({ oficina_id: oficinaId, nome: `Peca ${i} ${suffix}`, preco_custo: 1, preco_venda: 2, estoque })),
    });
    await prisma.pagamento.createMany({
      data: [
        { tipo: "receber" as const, descricao: "Receita A", valor: 10, valor_original: 10, status: "pago" as const },
        { tipo: "receber" as const, descricao: "Receita B", valor: 10, valor_original: 10, status: "pendente" as const },
        { tipo: "pagar" as const, descricao: "Despesa C", valor: 10, valor_original: 10, status: "pendente" as const },
      ].map((p) => ({ ...p, oficina_id: oficinaId, cliente_id: clienteId, data_vencimento: new Date("2026-01-31") })),
    });
  });

  afterAll(async () => {
    await prisma.pagamento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.peca.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.cliente.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.oficina.deleteMany({ where: { id: oficinaId } });
    await prisma.usuario.deleteMany({ where: { id: usuarioId } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  it("devolve a página pedida, ordenada, com o total no header", async () => {
    const r1 = await get("/api/clientes?page=1&limit=10");
    expect(r1.status).toBe(200);
    expect(r1.body).toHaveLength(10);
    expect(r1.headers["x-total-count"]).toBe("25");

    const r3 = await get("/api/clientes?page=3&limit=10");
    expect(r3.body).toHaveLength(5);
    expect(r3.body[0].nome).toContain("Cliente 20");
    expect(r3.headers["x-total-count"]).toBe("25");
  });

  it("sem page/limit mantém o comportamento antigo (array completo)", async () => {
    const r = await get("/api/clientes");
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body).toHaveLength(25);
  });

  it("limita o tamanho da página e ignora valores inválidos", async () => {
    expect((await get("/api/clientes?page=1&limit=9999")).body.length).toBeLessThanOrEqual(100);
    const r = await get("/api/clientes?page=abc&limit=-5");
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
  });

  it("a busca é aplicada no servidor e o total reflete o filtro", async () => {
    const r = await get(`/api/clientes?page=1&limit=10&search=${encodeURIComponent(`Cliente 07 ${suffix}`)}`);
    expect(r.body).toHaveLength(1);
    expect(r.headers["x-total-count"]).toBe("1");
  });

  it("pagamentos filtram por tipo, status e busca", async () => {
    const receber = await get("/api/pagamentos?page=1&limit=10&tipo=receber");
    expect(receber.headers["x-total-count"]).toBe("2");
    const pendentes = await get("/api/pagamentos?page=1&limit=10&tipo=receber&status=pendente");
    expect(pendentes.body.map((p: any) => p.descricao)).toEqual(["Receita B"]);
    const busca = await get("/api/pagamentos?page=1&limit=10&search=despesa");
    expect(busca.body.map((p: any) => p.descricao)).toEqual(["Despesa C"]);
  });

  it("peças: estoque baixo e ordenação no servidor", async () => {
    const baixo = await get("/api/pecas?page=1&limit=10&estoque_maximo=3&ordenar_por=estoque&direcao=desc");
    expect(baixo.body.map((p: any) => Number(p.estoque))).toEqual([2, 1]);
    expect(baixo.headers["x-total-count"]).toBe("2");
  });

  it("não vaza registros de outra oficina no total", async () => {
    const r = await get("/api/clientes?page=1&limit=100");
    expect(Number(r.headers["x-total-count"])).toBe(25);
  });
});
