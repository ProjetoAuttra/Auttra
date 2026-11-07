import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";
import { Prisma } from "../src/generated/prisma/client.js";
import { calcularTaxa } from "../src/services/maquininhas.service.js";
import { criarUsuarioComAcesso, removerUsuario } from "./sessao.js";

const suffix = Date.now();
const todas = ["read", "create", "update", "delete"];

describe("calcularTaxa", () => {
  const maq = {
    taxa_debito: new Prisma.Decimal(1.5),
    prazo_debito_dias: 1,
    taxas_credito: [3, 4, 5],
    prazo_credito_dias: 30,
    intervalo_parcelas_dias: 30,
    antecipacao: false,
  };
  const dia = new Date("2026-11-10T00:00:00.000Z");

  it("débito usa a taxa e o prazo do débito", () => {
    const t = calcularTaxa(maq, "cartao_debito", 5, new Prisma.Decimal(200), dia);
    expect(Number(t.valor_taxa)).toBe(3);
    expect(t.cartao_parcelas).toBe(1);
    expect(t.data_prevista_recebimento.toISOString().slice(0, 10)).toBe("2026-11-11");
  });

  it("crédito parcelado usa a taxa da parcela e a última parcela cai 30 dias depois de cada uma", () => {
    const t = calcularTaxa(maq, "cartao_credito", 3, new Prisma.Decimal(100), dia);
    expect(Number(t.taxa_percentual)).toBe(5);
    expect(Number(t.valor_taxa)).toBe(5);
    expect(t.data_prevista_recebimento.toISOString().slice(0, 10)).toBe("2027-02-08"); // 1ª em 30 dias, 3ª em 90
  });

  it("usa o intervalo entre parcelas configurado", () => {
    const t = calcularTaxa({ ...maq, intervalo_parcelas_dias: 28 }, "cartao_credito", 3, new Prisma.Decimal(100), dia);
    expect(t.data_prevista_recebimento.toISOString().slice(0, 10)).toBe("2027-02-04"); // 30 + 28 + 28 = 86 dias
  });

  it("com antecipação, o crédito parcelado cai todo no prazo do crédito", () => {
    const t = calcularTaxa({ ...maq, antecipacao: true, prazo_credito_dias: 1 }, "cartao_credito", 3, new Prisma.Decimal(100), dia);
    expect(t.data_prevista_recebimento.toISOString().slice(0, 10)).toBe("2026-11-11");
  });

  it("arredonda a taxa ao centavo", () => {
    const t = calcularTaxa({ ...maq, taxas_credito: [2.99] }, "cartao_credito", 1, new Prisma.Decimal(33.33), dia);
    expect(Number(t.valor_taxa)).toBe(1);
  });

  it("recusa parcelas acima do que a maquininha aceita", () => {
    expect(() => calcularTaxa(maq, "cartao_credito", 4, new Prisma.Decimal(100), dia)).toThrow(/1 a 3 parcelas/);
  });
});

describe.skipIf(!process.env.DATABASE_URL)("maquininhas e taxa no recebimento", () => {
  let cidadeId: number;
  let oficinaId: number;
  let outraOficinaId: number;
  let clienteId: number;
  let usuarioId: number;
  let gestor: string;
  let caixa: string;

  const api = (token: string) => ({
    get: (url: string) => request(app).get(url).set("Authorization", token),
    post: (url: string, body: object = {}) => request(app).post(url).set("Authorization", token).send(body),
    put: (url: string, body: object = {}) => request(app).put(url).set("Authorization", token).send(body),
    del: (url: string) => request(app).delete(url).set("Authorization", token),
  });

  const novoTitulo = async (valor: number) =>
    (
      await api(gestor)
        .post("/api/pagamentos", { tipo: "receber", valor, cliente_id: clienteId, data_vencimento: "2026-11-10", descricao: "Serviço" })
        .expect(201)
    ).body.id as number;

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Maq ${suffix}`, uf: "SP" } })).id;
    const oficina = (n: string) =>
      prisma.oficina.create({ data: { nome: `Oficina Maq ${n} ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId } });
    oficinaId = (await oficina("A")).id;
    outraOficinaId = (await oficina("B")).id;
    clienteId = (await prisma.cliente.create({ data: { nome: "Cliente Maq", oficina_id: oficinaId } })).id;
    usuarioId = await criarUsuarioComAcesso([oficinaId], "maquininha", "Gestor Maq");
    const token = (permissoes: object) =>
      "Bearer " +
      jwt.sign({ id: usuarioId, email: "m@example.com", nome: "Gestor", tipo: "gestoroficina", oficinaId, permissoes }, getJwtSecret(), {
        expiresIn: "5m",
      });
    gestor = token({ configuracoes: ["read", "update"], financeiro: todas, relatorios: ["read"] });
    caixa = token({ financeiro: ["read", "create", "update"] });
  });

  afterAll(async () => {
    await prisma.pagamento_movimento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.pagamento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.maquininha.deleteMany({ where: { oficina_id: { in: [oficinaId, outraOficinaId] } } });
    await prisma.cliente.deleteMany({ where: { oficina_id: oficinaId } });
    await removerUsuario(usuarioId);
    await prisma.oficina.deleteMany({ where: { id: { in: [oficinaId, outraOficinaId] } } });
    await prisma.cidade.delete({ where: { id: cidadeId } }).catch(() => {});
  });

  let stoneId: number;

  it("recebe no cartão sem taxa enquanto não há maquininha cadastrada", async () => {
    const id = await novoTitulo(100);
    const r = await api(gestor).post(`/api/pagamentos/${id}/pagar`, { metodo: "cartao_credito" }).expect(200);
    expect(r.body.status).toBe("pago");
    expect(Number(r.body.valor_taxa)).toBe(0);
    expect(r.body.maquininha_id).toBeNull();
  });

  it("cadastra a maquininha validando as taxas", async () => {
    await api(gestor).post("/api/configuracoes/maquininhas", { nome: "", taxas_credito: [3] }).expect(400);
    await api(gestor).post("/api/configuracoes/maquininhas", { nome: "X", taxas_credito: [101] }).expect(400);
    await api(gestor).post("/api/configuracoes/maquininhas", { nome: "X", intervalo_parcelas_dias: 0 }).expect(400);
    await api(caixa).post("/api/configuracoes/maquininhas", { nome: "Sem permissão" }).expect(403);

    const r = await api(gestor)
      .post("/api/configuracoes/maquininhas", {
        nome: "Stone balcão",
        operadora: "stone",
        taxa_debito: "1,5",
        prazo_debito_dias: 1,
        taxas_credito: [3, 4, 5],
        prazo_credito_dias: 30,
      })
      .expect(201);
    stoneId = r.body.id;
    expect(r.body.taxa_debito).toBe(1.5);
    expect(r.body.taxas_credito).toEqual([3, 4, 5]);
    expect(r.body.intervalo_parcelas_dias).toBe(30);
  });

  it("lista as ativas para quem recebe, e as inativas só para quem configura", async () => {
    const inativa = (await api(gestor).post("/api/configuracoes/maquininhas", { nome: "Antiga", ativo: false }).expect(201)).body.id;
    const doCaixa = (await api(caixa).get("/api/configuracoes/maquininhas?todas=true").expect(200)).body;
    expect(doCaixa.map((m: any) => m.id)).toEqual([stoneId]);
    const doGestor = (await api(gestor).get("/api/configuracoes/maquininhas?todas=true").expect(200)).body;
    expect(doGestor.map((m: any) => m.id)).toContain(inativa);
  });

  it("não deixa mexer em maquininha de outra oficina", async () => {
    const outra = await prisma.maquininha.create({ data: { oficina_id: outraOficinaId, nome: "Alheia" } });
    await api(gestor).put(`/api/configuracoes/maquininhas/${outra.id}`, { nome: "Minha" }).expect(404);
    const id = await novoTitulo(50);
    await api(gestor).post(`/api/pagamentos/${id}/pagar`, { metodo: "cartao_debito", maquininha_id: outra.id }).expect(404);
  });

  it("com maquininha cadastrada, exige escolher uma ao receber no cartão", async () => {
    const id = await novoTitulo(100);
    const r = await api(gestor).post(`/api/pagamentos/${id}/pagar`, { metodo: "cartao_debito" }).expect(400);
    expect(r.body.message).toMatch(/maquininha/i);
    // Pix continua sem maquininha.
    await api(gestor).post(`/api/pagamentos/${id}/pagar`, { metodo: "pix" }).expect(200);
  });

  it("grava a taxa do crédito parcelado no título e no movimento", async () => {
    const id = await novoTitulo(200);
    const r = await api(caixa)
      .post(`/api/pagamentos/${id}/pagar`, { metodo: "cartao_credito", maquininha_id: stoneId, cartao_parcelas: 2, data_pagamento: "2026-11-10" })
      .expect(200);
    expect(Number(r.body.valor_taxa)).toBe(8);
    expect(Number(r.body.taxa_percentual)).toBe(4);
    expect(r.body.cartao_parcelas).toBe(2);
    expect(r.body.maquininha.nome).toBe("Stone balcão");
    expect(r.body.data_prevista_recebimento.slice(0, 10)).toBe("2027-01-09");

    const movs = (await api(caixa).get(`/api/pagamentos/${id}/movimentos`).expect(200)).body;
    expect(Number(movs[0].valor_taxa)).toBe(8);
  });

  it("mudar a taxa depois não muda o que já foi recebido", async () => {
    await api(gestor).put(`/api/configuracoes/maquininhas/${stoneId}`, { taxas_credito: [3, 9, 9] }).expect(200);
    const titulos = await prisma.pagamento.findMany({ where: { oficina_id: oficinaId, cartao_parcelas: 2 } });
    expect(titulos.every((t) => Number(t.valor_taxa) === 8)).toBe(true);
  });

  it("recebimento parcial no cartão cobra a taxa só do valor recebido", async () => {
    const id = await novoTitulo(100);
    const r = await api(caixa)
      .post(`/api/pagamentos/${id}/pagar`, { metodo: "cartao_debito", maquininha_id: stoneId, valor: 40 })
      .expect(200);
    expect(Number(r.body.valor_taxa)).toBe(0.6);
    expect(Number(r.body.titulo_saldo.valor_taxa)).toBe(0);
  });

  it("estorno devolve a taxa e limpa a maquininha do título", async () => {
    const id = await novoTitulo(100);
    await api(caixa).post(`/api/pagamentos/${id}/pagar`, { metodo: "cartao_debito", maquininha_id: stoneId }).expect(200);
    const r = await api(gestor).post(`/api/pagamentos/${id}/estornar`, { motivo: "Cliente desistiu" }).expect(200);
    expect(Number(r.body.valor_taxa)).toBe(0);
    expect(r.body.maquininha_id).toBeNull();
    const movs = await prisma.pagamento_movimento.findMany({ where: { pagamento_id: id }, orderBy: { id: "asc" } });
    expect(movs.map((m) => [m.tipo, Number(m.valor_taxa)])).toEqual([["pagamento", 1.5], ["estorno", 1.5]]);
  });

  it("não aceita maquininha em conta a pagar nem em pix", async () => {
    const id = await novoTitulo(10);
    await api(caixa).post(`/api/pagamentos/${id}/pagar`, { metodo: "pix", maquininha_id: stoneId }).expect(400);
  });

  it("maquininha inativa ou excluída não recebe mais", async () => {
    const tmp = (await api(gestor).post("/api/configuracoes/maquininhas", { nome: "Temporária", taxas_credito: [2] }).expect(201)).body.id;
    await api(gestor).del(`/api/configuracoes/maquininhas/${tmp}`).expect(204);
    const id = await novoTitulo(10);
    await api(caixa).post(`/api/pagamentos/${id}/pagar`, { metodo: "cartao_credito", maquininha_id: tmp }).expect(404);
  });

  it("precisa aceitar débito, crédito ou os dois", async () => {
    await api(gestor).post("/api/configuracoes/maquininhas", { nome: "Nada", aceita_debito: false, aceita_credito: false }).expect(400);
    await api(gestor).put(`/api/configuracoes/maquininhas/${stoneId}`, { aceita_debito: false, aceita_credito: false }).expect(400);
  });

  it("maquininha só de crédito não recebe débito, e débito sem maquininha que aceite segue sem taxa", async () => {
    const link = (await api(gestor).post("/api/configuracoes/maquininhas", { nome: "Link", aceita_debito: false, taxas_credito: [4] }).expect(201)).body;
    expect(link.aceita_debito).toBe(false);
    const id = await novoTitulo(100);
    const r = await api(caixa).post(`/api/pagamentos/${id}/pagar`, { metodo: "cartao_debito", maquininha_id: link.id }).expect(400);
    expect(r.body.message).toMatch(/não aceita débito/);

    // Com a Stone só no crédito, nenhuma aceita débito: o débito entra sem maquininha, como antes.
    await api(gestor).put(`/api/configuracoes/maquininhas/${stoneId}`, { aceita_debito: false }).expect(200);
    const ok = await api(caixa).post(`/api/pagamentos/${id}/pagar`, { metodo: "cartao_debito" }).expect(200);
    expect(Number(ok.body.valor_taxa)).toBe(0);
    await api(gestor).put(`/api/configuracoes/maquininhas/${stoneId}`, { aceita_debito: true }).expect(200);
    await api(gestor).del(`/api/configuracoes/maquininhas/${link.id}`).expect(204);
  });

  it("extrato e resultado mostram as taxas", async () => {
    const ext = (await api(gestor).get("/api/pagamentos/extrato/resumo").expect(200)).body;
    expect(ext.taxas_cartao).toBeCloseTo(8.6, 2); // 8 (crédito 2x) + 0,60 (débito parcial); o estornado não conta
    expect(ext.entradas_liquidas).toBeCloseTo(ext.entradas - 8.6, 2);

    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const res = (await api(gestor).get(`/api/relatorios/resultado?from=${hoje}&to=${hoje}`).expect(200)).body;
    expect(res.taxas_cartao).toBeCloseTo(8.6, 2);
    expect(res.despesas_por_categoria).toContainEqual({ categoria: "Taxas de cartão", valor: 8.6 });
  });
});
