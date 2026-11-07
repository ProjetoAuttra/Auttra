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

describe("cronograma do recebimento no cartão", () => {
  const maq = {
    taxa_debito: new Prisma.Decimal(1.5), prazo_debito_dias: 1, taxas_credito: [3, 4, 5],
    prazo_credito_dias: 30, intervalo_parcelas_dias: 30, antecipacao: false,
  };
  const dia = new Date("2026-11-10T00:00:00.000Z");
  const datas = (c: { data_prevista: Date }[]) => c.map((x) => x.data_prevista.toISOString().slice(0, 10));

  it("crédito parcelado: uma parcela por mês, centavos que sobram na última", () => {
    const { cronograma } = calcularTaxa(maq, "cartao_credito", 3, new Prisma.Decimal(100), dia);
    expect(cronograma.map((c) => Number(c.valor_bruto))).toEqual([33.33, 33.33, 33.34]);
    expect(cronograma.map((c) => Number(c.valor_taxa))).toEqual([1.66, 1.66, 1.68]);
    expect(cronograma.reduce((s, c) => s + Number(c.valor_liquido), 0)).toBeCloseTo(95, 2);
    expect(datas(cronograma)).toEqual(["2026-12-10", "2027-01-09", "2027-02-08"]);
  });

  it("débito, à vista e antecipação caem de uma vez", () => {
    expect(calcularTaxa(maq, "cartao_debito", 1, new Prisma.Decimal(100), dia).cronograma).toHaveLength(1);
    const ant = calcularTaxa({ ...maq, antecipacao: true, prazo_credito_dias: 1 }, "cartao_credito", 3, new Prisma.Decimal(100), dia);
    expect(ant.cronograma).toHaveLength(1);
    expect(datas(ant.cronograma)).toEqual(["2026-11-11"]);
  });

  it("um instante à noite no Brasil conta pelo dia do Brasil, não pelo de UTC", () => {
    const noite = new Date("2026-11-11T01:30:00.000Z"); // 10/11 às 22h30 em Brasília
    expect(datas(calcularTaxa(maq, "cartao_debito", 1, new Prisma.Decimal(10), noite).cronograma)).toEqual(["2026-11-11"]);
  });
});

describe.skipIf(!process.env.DATABASE_URL)("extrato por efetivação", () => {
  let cidadeId: number;
  let oficinaId: number;
  let clienteId: number;
  let fornecedorId: number;
  let usuarioId: number;
  let auth: string;
  let maquininhaId: number;
  let creditoId: number;

  const get = (url: string) => request(app).get(url).set("Authorization", auth);
  const post = (url: string, body: object) => request(app).post(url).set("Authorization", auth).send(body);
  const titulo = async (tipo: "receber" | "pagar", valor: number) =>
    (
      await post("/api/pagamentos", {
        tipo, valor, data_vencimento: "2026-11-10", descricao: `Título ${valor}`,
        ...(tipo === "receber" ? { cliente_id: clienteId } : { fornecedor_id: fornecedorId }),
      }).expect(201)
    ).body.id as number;
  const efetivacao = async (de: string, ate: string) => (await get(`/api/pagamentos/extrato/efetivacao?de=${de}&ate=${ate}`).expect(200)).body;

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Efet ${suffix}`, uf: "SP" } })).id;
    oficinaId = (
      await prisma.oficina.create({ data: { nome: `Oficina Efet ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId } })
    ).id;
    clienteId = (await prisma.cliente.create({ data: { nome: "Cliente Efet", oficina_id: oficinaId } })).id;
    fornecedorId = (await prisma.fornecedor.create({ data: { nome: "Fornecedor Efet", oficina_id: oficinaId, cidade_id: cidadeId } })).id;
    usuarioId = await criarUsuarioComAcesso([oficinaId], "efetivacao", "Gestor Efet");
    auth =
      "Bearer " +
      jwt.sign(
        { id: usuarioId, email: "e@example.com", nome: "Gestor", tipo: "gestoroficina", oficinaId, permissoes: { financeiro: todas, configuracoes: ["read", "update"] } },
        getJwtSecret(),
        { expiresIn: "5m" }
      );
    maquininhaId = (
      await post("/api/configuracoes/maquininhas", {
        nome: "Stone", taxa_debito: 1.5, prazo_debito_dias: 1, taxas_credito: [3, 4, 5], prazo_credito_dias: 30,
      }).expect(201)
    ).body.id;

    creditoId = await titulo("receber", 300);
    await post(`/api/pagamentos/${creditoId}/pagar`, {
      metodo: "cartao_credito", maquininha_id: maquininhaId, cartao_parcelas: 3, data_pagamento: "2026-11-10",
    }).expect(200);
    await post(`/api/pagamentos/${await titulo("receber", 50)}/pagar`, { metodo: "pix", data_pagamento: "2026-11-12" }).expect(200);
    await post(`/api/pagamentos/${await titulo("pagar", 20)}/pagar`, { metodo: "boleto", data_pagamento: "2026-11-15" }).expect(200);
    await post(`/api/pagamentos/${await titulo("receber", 100)}/pagar`, {
      metodo: "cartao_debito", maquininha_id: maquininhaId, data_pagamento: "2026-11-20",
    }).expect(200);
  }, 30_000);

  afterAll(async () => {
    await prisma.recebivel.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.pagamento_movimento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.pagamento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.maquininha.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.fornecedor.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.cliente.deleteMany({ where: { oficina_id: oficinaId } });
    await removerUsuario(usuarioId);
    await prisma.oficina.deleteMany({ where: { id: oficinaId } });
    await prisma.cidade.delete({ where: { id: cidadeId } }).catch(() => {});
  });

  it("grava uma parcela por mês para o crédito parcelado", async () => {
    const r = await prisma.recebivel.findMany({ where: { pagamento_id: creditoId }, orderBy: { parcela: "asc" } });
    expect(r.map((x) => [x.parcela, x.total_parcelas, Number(x.valor_liquido), x.data_prevista.toISOString().slice(0, 10)])).toEqual([
      [1, 3, 95, "2026-12-10"],
      [2, 3, 95, "2027-01-09"],
      [3, 3, 95, "2027-02-08"],
    ]);
  });

  it("no mês da venda, o crédito parcelado ainda não caiu; pix, boleto e débito sim", async () => {
    const linhas = await efetivacao("2026-11-01", "2026-11-30");
    expect(linhas.map((l: any) => [l.data, l.tipo, l.valor])).toEqual([
      ["2026-11-21", "receber", 98.5], // débito: líquido, um dia depois
      ["2026-11-15", "pagar", 20],
      ["2026-11-12", "receber", 50],
    ]);
    const resumo = (await get("/api/pagamentos/extrato/efetivacao/resumo?de=2026-11-01&ate=2026-11-30").expect(200)).body;
    expect(resumo).toMatchObject({ entradas: 148.5, saidas: 20, saldo: 128.5, taxas_cartao: 1.5, qtd_entradas: 2, qtd_saidas: 1 });
  });

  it("cada parcela aparece no mês em que cai, líquida e com a maquininha", async () => {
    const [dez] = await efetivacao("2026-12-01", "2026-12-31");
    expect(dez).toMatchObject({ data: "2026-12-10", valor: 95, valor_bruto: 100, valor_taxa: 5, parcela: 1, total_parcelas: 3, maquininha: "Stone" });
  });

  it("pagina e informa o total", async () => {
    const r = await get("/api/pagamentos/extrato/efetivacao?de=2026-11-01&ate=2027-12-31&page=1&limit=2").expect(200);
    expect(r.body).toHaveLength(2);
    expect(r.headers["x-total-count"]).toBe("6");
  });

  it("a visão por recebimento continua igual: bruto, no dia da venda", async () => {
    const resumo = (await get("/api/pagamentos/extrato/resumo?pagamento_de=2026-11-01&pagamento_ate=2026-11-30").expect(200)).body;
    expect(resumo.entradas).toBe(450);
  });

  it("o estorno apaga o que ia cair", async () => {
    const id = await titulo("receber", 60);
    await post(`/api/pagamentos/${id}/pagar`, { metodo: "cartao_credito", maquininha_id: maquininhaId, cartao_parcelas: 2 }).expect(200);
    expect(await prisma.recebivel.count({ where: { pagamento_id: id } })).toBe(2);
    await post(`/api/pagamentos/${id}/estornar`, { motivo: "Cliente desistiu" }).expect(200);
    expect(await prisma.recebivel.count({ where: { pagamento_id: id } })).toBe(0);
  });

  it("a-cair soma as parcelas futuras", async () => {
    const r = (await get("/api/pagamentos/extrato/a-cair").expect(200)).body;
    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const futuras = await prisma.recebivel.findMany({ where: { oficina_id: oficinaId, data_prevista: { gt: new Date(`${hoje}T00:00:00.000Z`) } } });
    expect(r.qtd).toBe(futuras.length);
    expect(r.total).toBeCloseTo(futuras.reduce((s, x) => s + Number(x.valor_liquido), 0), 2);
  });
});
