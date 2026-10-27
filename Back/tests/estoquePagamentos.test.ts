import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";

const suffix = Date.now();
const todas = ["read", "create", "update", "delete"];

describe.skipIf(!process.env.DATABASE_URL)("estoque e pagamentos (atomicidade)", () => {
  let cidadeId: number;
  let oficinaId: number;
  let clienteId: number;
  let veiculoId: number;
  let funcionarioId: number;
  let auth: string;
  const pecasCriadas: number[] = [];

  const novaPeca = async (estoque: number) => {
    const peca = await prisma.peca.create({
      data: { oficina_id: oficinaId, nome: `Peca ${suffix}-${pecasCriadas.length}`, preco_custo: 10, preco_venda: 20, estoque },
    });
    pecasCriadas.push(peca.id);
    return peca.id;
  };
  const estoqueDe = async (id: number) => (await prisma.peca.findUniqueOrThrow({ where: { id } })).estoque;
  const criarOs = (pecaId: number, quantidade = 1) =>
    request(app)
      .post("/api/ordens")
      .set("Authorization", auth)
      .send({
        cliente_id: clienteId,
        veiculo_id: veiculoId,
        funcionario_id: funcionarioId,
        valor_total: 20 * quantidade,
        itens: [{ tipo_item: "peca", peca_id: pecaId, quantidade, preco_unitario: 20, subtotal: 20 * quantidade }],
      });
  const novoPagamento = async (valor: number, extra: Record<string, unknown> = {}) =>
    (
      await request(app)
        .post("/api/pagamentos")
        .set("Authorization", auth)
        .send({ tipo: "pagar", valor, data_vencimento: "2026-01-31", descricao: "Conta", ...extra })
    ).body.id as number;

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Atom ${suffix}`, uf: "SP" } })).id;
    oficinaId = (
      await prisma.oficina.create({
        data: { nome: `Oficina Atom ${suffix}`, logradouro: "Rua Teste", numero: "1", cep: "00000000", cidade_id: cidadeId },
      })
    ).id;
    clienteId = (await prisma.cliente.create({ data: { nome: "Cliente Atom", oficina_id: oficinaId } })).id;
    veiculoId = (
      await prisma.veiculo.create({ data: { marca: "Fiat", modelo: "Uno", placa: `ATM${suffix % 10000}`, oficina_id: oficinaId, cliente_id: clienteId } })
    ).id;
    funcionarioId = (
      await prisma.funcionario.create({ data: { nome: "Mecanico", cargo: "mecanico", data_contratacao: new Date(), oficina_id: oficinaId } })
    ).id;
    auth =
      "Bearer " +
      jwt.sign(
        { id: 1, email: "g@example.com", nome: "Gestor", tipo: "gestoroficina", oficinaId, permissoes: { ordens: todas, financeiro: todas } },
        getJwtSecret(),
        { expiresIn: "5m" }
      );
  });

  afterAll(async () => {
    await prisma.pagamento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.item_ordem_servico.deleteMany({ where: { ordem_servico: { oficina_id: oficinaId } } });
    await prisma.ordem_servico.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.peca.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.funcionario.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.veiculo.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.cliente.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.oficina.deleteMany({ where: { id: oficinaId } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  describe("estoque", () => {
    it("duas OS concorrentes disputando a ultima peca: so uma passa e o estoque nao fica negativo", async () => {
      const pecaId = await novaPeca(1);
      const [a, b] = await Promise.all([criarOs(pecaId), criarOs(pecaId)]);

      expect([a.status, b.status].sort()).toEqual([201, 400]);
      expect(await estoqueDe(pecaId)).toBe(0);
    });

    it("rejeita quantidade invalida", async () => {
      const pecaId = await novaPeca(10);
      expect((await criarOs(pecaId, 0)).status).toBe(400);
      expect((await criarOs(pecaId, -3)).status).toBe(400);
      expect(await estoqueDe(pecaId)).toBe(10);
    });

    it("cancelar devolve o estoque uma vez; editar itens da OS cancelada eh bloqueado; excluir nao devolve de novo", async () => {
      const pecaId = await novaPeca(5);
      const os = (await criarOs(pecaId, 2)).body;
      expect(await estoqueDe(pecaId)).toBe(3);

      await request(app).put(`/api/ordens/${os.id}`).set("Authorization", auth).send({ status: "cancelada" }).expect(200);
      expect(await estoqueDe(pecaId)).toBe(5);

      const editar = await request(app)
        .put(`/api/ordens/${os.id}`)
        .set("Authorization", auth)
        .send({ itens: [{ tipo_item: "peca", peca_id: pecaId, quantidade: 4, preco_unitario: 20, subtotal: 80 }] });
      expect(editar.status).toBeGreaterThanOrEqual(400);
      expect(await estoqueDe(pecaId)).toBe(5);

      await request(app).delete(`/api/ordens/${os.id}`).set("Authorization", auth).expect(204);
      expect(await estoqueDe(pecaId)).toBe(5);
    });

    it("reenviar os mesmos itens em OS finalizada (edicao de observacao) continua funcionando", async () => {
      const pecaId = await novaPeca(5);
      const os = (await criarOs(pecaId, 1)).body;
      await request(app).put(`/api/ordens/${os.id}`).set("Authorization", auth).send({ status: "em_andamento" }).expect(200);
      await request(app).put(`/api/ordens/${os.id}`).set("Authorization", auth).send({ status: "concluida" }).expect(200);

      const mesmos = os.itens.map((i: any) => ({ tipo_item: i.tipo_item, peca_id: i.peca_id, quantidade: i.quantidade, preco_unitario: i.preco_unitario }));
      const res = await request(app).put(`/api/ordens/${os.id}`).set("Authorization", auth).send({ observacoes: "ok", itens: mesmos });

      expect(res.status).toBe(200);
      expect(res.body.observacoes).toBe("ok");
      expect(await estoqueDe(pecaId)).toBe(4);
    });
  });

  describe("pagamentos", () => {
    it("duas baixas concorrentes: so uma registra o pagamento", async () => {
      const id = await novaPagamentoPendente();
      const [a, b] = await Promise.all([
        request(app).post(`/api/pagamentos/${id}/pagar`).set("Authorization", auth).send({ metodo: "pix" }),
        request(app).post(`/api/pagamentos/${id}/pagar`).set("Authorization", auth).send({ metodo: "pix" }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 400]);
    });

    async function novaPagamentoPendente() {
      return novoPagamento(100);
    }

    it("parciais concorrentes nunca somam mais que o valor devido", async () => {
      const id = await novoPagamento(100);
      const respostas = await Promise.all(
        [60, 60].map((v) =>
          request(app).post(`/api/pagamentos/${id}/pagamento-parcial`).set("Authorization", auth).send({ valor_entrada: v, metodo: "pix" })
        )
      );
      expect(respostas.map((r) => r.status).sort()).toEqual([200, 400]);
      const p = await prisma.pagamento.findUniqueOrThrow({ where: { id } });
      expect(Number(p.valor_pago)).toBe(60);
      expect(p.status).toBe("parcial");
    });

    it("parcial acima do saldo e entrada invalida sao rejeitados; quitar fecha como pago", async () => {
      const id = await novoPagamento(100);
      const post = (v: unknown) =>
        request(app).post(`/api/pagamentos/${id}/pagamento-parcial`).set("Authorization", auth).send({ valor_entrada: v, metodo: "pix" });

      expect((await post(100.01)).status).toBe(400);
      expect((await post(-5)).status).toBe(400);
      expect((await post("abc")).status).toBe(400);
      const quitar = await post(100);
      expect(quitar.status).toBe(200);
      expect(quitar.body.status).toBe("pago");
    });

    it("nao paga titulo cancelado/excluido", async () => {
      const id = await novoPagamento(50);
      await request(app).delete(`/api/pagamentos/${id}`).set("Authorization", auth).expect(204);
      expect((await request(app).post(`/api/pagamentos/${id}/pagar`).set("Authorization", auth).send({ metodo: "pix" })).status).toBe(400);
    });

    it("PUT ignora status/valor_pago/desconto e alterar valor atualiza valor_original", async () => {
      const id = await novoPagamento(100);
      const res = await request(app)
        .put(`/api/pagamentos/${id}`)
        .set("Authorization", auth)
        .send({ status: "pago", valor_pago: 100, desconto: 99, deleted_at: new Date(), descricao: "Nova", valor: 150 });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "pendente", descricao: "Nova", deleted_at: null });
      expect(Number(res.body.valor_pago)).toBe(0);
      expect(Number(res.body.desconto)).toBe(0);
      expect(Number(res.body.valor)).toBe(150);
      expect(Number(res.body.valor_original)).toBe(150);
    });

    it("nao permite alterar o valor depois de haver pagamento parcial", async () => {
      const id = await novoPagamento(100);
      await request(app).post(`/api/pagamentos/${id}/pagamento-parcial`).set("Authorization", auth).send({ valor_entrada: 10, metodo: "pix" }).expect(200);
      expect((await request(app).put(`/api/pagamentos/${id}`).set("Authorization", auth).send({ valor: 500 })).status).toBe(400);
    });

    it("criacao sempre nasce pendente, mesmo se o body mandar pago", async () => {
      const res = await request(app)
        .post("/api/pagamentos")
        .set("Authorization", auth)
        .send({ tipo: "pagar", valor: 10, data_vencimento: "2026-03-01", status: "pago", data_pagamento: "2026-03-01" });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe("pendente");
      expect(res.body.data_pagamento).toBeNull();
    });

    it("parcelar: a soma das parcelas fecha exatamente e 31/jan nao pula para marco", async () => {
      const id = await novoPagamento(100, { data_vencimento: "2026-01-31T12:00:00" });
      const res = await request(app)
        .post(`/api/pagamentos/${id}/parcelar`)
        .set("Authorization", auth)
        .send({ total_parcelas: 3, data_primeira_parcela: "2026-01-31T12:00:00" });

      expect(res.status).toBe(201);
      const valores = res.body.parcelas.map((p: any) => Number(p.valor));
      expect(valores).toEqual([33.33, 33.33, 33.34]);
      const meses = res.body.parcelas.map((p: any) => new Date(p.data_vencimento).toISOString().slice(0, 10));
      expect(meses[1].startsWith("2026-02-")).toBe(true);
      expect(meses[2].startsWith("2026-03-")).toBe(true);
    });

    it("parcelar rejeita numero de parcelas invalido", async () => {
      const id = await novoPagamento(100);
      for (const total_parcelas of [1, 2.5, 500]) {
        const res = await request(app).post(`/api/pagamentos/${id}/parcelar`).set("Authorization", auth).send({ total_parcelas, data_primeira_parcela: "2026-05-01" });
        expect(res.status).toBe(400);
      }
    });

    it("desconto: rejeita negativo e desconto que deixaria o valor abaixo do ja pago", async () => {
      const id = await novoPagamento(100);
      await request(app).post(`/api/pagamentos/${id}/pagamento-parcial`).set("Authorization", auth).send({ valor_entrada: 80, metodo: "pix" }).expect(200);
      const desc = (v: number) => request(app).post(`/api/pagamentos/${id}/desconto`).set("Authorization", auth).send({ desconto: v, motivo_desconto: "x" });

      expect((await desc(-1)).status).toBe(400);
      expect((await desc(30)).status).toBe(400);
      expect((await desc(20)).status).toBe(200);
    });

    it("extrato filtra com apenas from ou apenas to", async () => {
      await novoPagamento(10, { data_vencimento: "2030-06-15" });
      const so_from = await request(app).get("/api/pagamentos/extrato/oficina/1?from=2030-01-01").set("Authorization", auth);
      const so_to = await request(app).get("/api/pagamentos/extrato/oficina/1?to=2000-01-01").set("Authorization", auth);

      expect(so_from.body.pagamentos.length).toBeGreaterThan(0);
      expect(so_from.body.pagamentos.every((p: any) => new Date(p.data_vencimento) >= new Date("2030-01-01"))).toBe(true);
      expect(so_to.body.pagamentos).toEqual([]);
    });
  });
});
