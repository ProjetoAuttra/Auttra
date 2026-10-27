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
  let authSemDelete: string;
  let usuarioId: number;
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
    usuarioId = (
      await prisma.usuario.create({ data: { email: `estorno-${suffix}@example.com`, senha: "x", nome: "Gestor Estorno", tipo: "funcionario" } })
    ).id;
    const tokenCom = (permissoes: object) =>
      "Bearer " +
      jwt.sign(
        { id: usuarioId, email: "g@example.com", nome: "Gestor", tipo: "gestoroficina", oficinaId, permissoes },
        getJwtSecret(),
        { expiresIn: "5m" }
      );
    auth = tokenCom({ ordens: todas, financeiro: todas, orcamentos: todas });
    authSemDelete = tokenCom({ financeiro: ["read", "create", "update"] });
  });

  afterAll(async () => {
    await prisma.pagamento_movimento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.pagamento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.item_orcamento.deleteMany({ where: { orcamento: { cliente_id: clienteId } } });
    await prisma.orcamento.deleteMany({ where: { cliente_id: clienteId } });
    await prisma.item_ordem_servico.deleteMany({ where: { ordem_servico: { oficina_id: oficinaId } } });
    await prisma.ordem_servico.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.peca.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.funcionario.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.veiculo.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.cliente.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.oficina.deleteMany({ where: { id: oficinaId } });
    await prisma.usuario.deleteMany({ where: { id: usuarioId } });
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
      expect((await request(app).post(`/api/pagamentos/${id}/pagar`).set("Authorization", auth).send({ metodo: "pix" })).status).toBe(404);
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

  describe("excluir titulo pago exige estorno", () => {
    it("titulo pago: 409 com codigo e pedido de estorno; continua existindo", async () => {
      const id = await novoPagamento(100);
      await request(app).post(`/api/pagamentos/${id}/pagar`).set("Authorization", auth).send({ metodo: "pix" }).expect(200);

      const res = await request(app).delete(`/api/pagamentos/${id}`).set("Authorization", auth);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("PAGAMENTO_REQUER_ESTORNO");
      expect(res.body.message).toMatch(/estorne/i);
      const p = await prisma.pagamento.findUniqueOrThrow({ where: { id } });
      expect(p.status).toBe("pago");
      expect(p.deleted_at).toBeNull();
    });

    it("titulo com pagamento parcial tambem exige estorno", async () => {
      const id = await novoPagamento(100);
      await request(app).post(`/api/pagamentos/${id}/pagamento-parcial`).set("Authorization", auth).send({ valor_entrada: 10, metodo: "pix" }).expect(200);

      expect((await request(app).delete(`/api/pagamentos/${id}`).set("Authorization", auth)).status).toBe(409);
    });

    it("titulo pendente pode ser excluido (204) e depois nao existe mais (404)", async () => {
      const id = await novoPagamento(100);
      await request(app).delete(`/api/pagamentos/${id}`).set("Authorization", auth).expect(204);
      expect((await request(app).get(`/api/pagamentos/${id}`).set("Authorization", auth)).status).toBe(404);
    });

    it("excluir OS com pagamento registrado: 409 pedindo estorno", async () => {
      const pecaId = await novaPeca(5);
      const os = (await criarOs(pecaId)).body;
      const pg = (
        await request(app)
          .post("/api/pagamentos")
          .set("Authorization", auth)
          .send({ tipo: "receber", valor: 20, ordem_servico_id: os.id, data_vencimento: "2026-05-01" })
      ).body.id;
      await request(app).post(`/api/pagamentos/${pg}/pagar`).set("Authorization", auth).send({ metodo: "pix" }).expect(200);

      const res = await request(app).delete(`/api/ordens/${os.id}`).set("Authorization", auth);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("PAGAMENTO_REQUER_ESTORNO");
      expect(await estoqueDe(pecaId)).toBe(4);
    });
  });

  describe("subtotal e valor_total sao calculados no servidor", () => {
    const item = (pecaId: number, quantidade: number, preco: number, mentira: number) => ({
      tipo_item: "peca",
      peca_id: pecaId,
      quantidade,
      preco_unitario: preco,
      subtotal: mentira,
    });

    it("criar OS ignora subtotal e valor_total enviados", async () => {
      const pecaId = await novaPeca(10);
      const res = await request(app)
        .post("/api/ordens")
        .set("Authorization", auth)
        .send({ cliente_id: clienteId, veiculo_id: veiculoId, funcionario_id: funcionarioId, valor_total: 1, itens: [item(pecaId, 3, 19.99, 0.01)] });

      expect(res.status).toBe(201);
      expect(Number(res.body.valor_total)).toBe(59.97);
      expect(Number(res.body.itens[0].subtotal)).toBe(59.97);
    });

    it("editar itens recalcula o total; editar sem itens ignora valor_total enviado", async () => {
      const pecaId = await novaPeca(10);
      const os = (await criarOs(pecaId, 1)).body;

      const atualizada = await request(app)
        .put(`/api/ordens/${os.id}`)
        .set("Authorization", auth)
        .send({ valor_total: 5, itens: [item(pecaId, 2, 50, 1), item(pecaId, 1, 10.5, 1)] });
      expect(atualizada.status).toBe(200);
      expect(Number(atualizada.body.valor_total)).toBe(110.5);

      const semItens = await request(app).put(`/api/ordens/${os.id}`).set("Authorization", auth).send({ valor_total: 999, observacoes: "x" });
      expect(semItens.status).toBe(200);
      expect(Number(semItens.body.valor_total)).toBe(110.5);
    });

    it("rejeita item com preco negativo ou quantidade invalida (400)", async () => {
      const pecaId = await novaPeca(10);
      const base = { cliente_id: clienteId, veiculo_id: veiculoId, funcionario_id: funcionarioId };
      const preco = await request(app).post("/api/ordens").set("Authorization", auth).send({ ...base, itens: [item(pecaId, 1, -5, 0)] });
      const qtd = await request(app).post("/api/ordens").set("Authorization", auth).send({ ...base, itens: [item(pecaId, 1.5, 5, 0)] });

      expect(preco.status).toBe(400);
      expect(qtd.status).toBe(400);
      expect(await estoqueDe(pecaId)).toBe(10);
    });

    it("orcamento: subtotal e valor sao recalculados", async () => {
      const res = await request(app)
        .post("/api/orcamentos")
        .set("Authorization", auth)
        .send({
          clienteId,
          veiculoId,
          descricao: "Teste",
          valor: 1,
          data: "2026-05-01",
          itens: [{ tipo_item: "servico", nome: "Revisao", quantidade: 2, preco_unitario: 150.25, subtotal: 1 }],
        });

      expect(res.status).toBe(201);
      expect(Number(res.body.valor)).toBe(300.5);
      expect(Number(res.body.itens[0].subtotal)).toBe(300.5);
    });
  });

  describe("codigos de resposta", () => {
    it("404 quando nao existe", async () => {
      expect((await request(app).get("/api/pagamentos/99999999").set("Authorization", auth)).status).toBe(404);
      expect((await request(app).get("/api/ordens/99999999").set("Authorization", auth)).status).toBe(404);
      expect((await request(app).post("/api/pagamentos/99999999/pagar").set("Authorization", auth).send({ metodo: "pix" })).status).toBe(404);
    });

    it("400 com { message } para validacao", async () => {
      const res = await request(app).post("/api/pagamentos").set("Authorization", auth).send({ tipo: "pagar", valor: -1, data_vencimento: "2026-01-01" });

      expect(res.status).toBe(400);
      expect(typeof res.body.message).toBe("string");
    });
  });

  describe("estorno e historico (ledger)", () => {
    const post = (path: string, body: object = {}, token = auth) =>
      request(app).post(path).set("Authorization", token).send(body);
    const movimentos = (id: number) => prisma.pagamento_movimento.findMany({ where: { pagamento_id: id }, orderBy: { id: "asc" } });

    it("pagar e parcial gravam movimentos com o usuario; valor_pago = soma dos movimentos", async () => {
      const id = await novoPagamento(100);
      await post(`/api/pagamentos/${id}/pagamento-parcial`, { valor_entrada: 30, metodo: "dinheiro" }).expect(200);
      await post(`/api/pagamentos/${id}/pagar`, { metodo: "pix" }).expect(200);

      const movs = await movimentos(id);
      expect(movs.map((m) => [m.tipo, Number(m.valor), m.metodo, m.usuario_id])).toEqual([
        ["pagamento", 30, "dinheiro", usuarioId],
        ["pagamento", 70, "pix", usuarioId],
      ]);
      const p = await prisma.pagamento.findUniqueOrThrow({ where: { id } });
      expect(Number(p.valor_pago)).toBe(100);
    });

    it("estornar: volta para pendente, mantem o historico e registra motivo e usuario", async () => {
      const id = await novoPagamento(100);
      await post(`/api/pagamentos/${id}/pagamento-parcial`, { valor_entrada: 30, metodo: "dinheiro" }).expect(200);
      await post(`/api/pagamentos/${id}/pagar`, { metodo: "pix" }).expect(200);

      const res = await post(`/api/pagamentos/${id}/estornar`, { motivo: "Cliente pagou em duplicidade" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "pendente", data_pagamento: null });
      expect(Number(res.body.valor_pago)).toBe(0);

      const movs = await movimentos(id);
      expect(movs).toHaveLength(4); // nada foi apagado
      const [p1, p2, e1, e2] = movs;
      expect([e1.tipo, e2.tipo]).toEqual(["estorno", "estorno"]);
      expect([e1.estorno_de_id, e2.estorno_de_id]).toEqual([p1.id, p2.id]);
      expect([Number(e1.valor), Number(e2.valor)]).toEqual([30, 70]);
      expect(e1.motivo).toBe("Cliente pagou em duplicidade");
      expect(e1.usuario_id).toBe(usuarioId);
    });

    it("depois do estorno o titulo pode ser pago de novo e tambem excluido", async () => {
      const id = await novoPagamento(100);
      await post(`/api/pagamentos/${id}/pagar`, { metodo: "pix" }).expect(200);
      await post(`/api/pagamentos/${id}/estornar`, { motivo: "erro" }).expect(200);
      await post(`/api/pagamentos/${id}/pagar`, { metodo: "cartao" }).expect(200);
      await post(`/api/pagamentos/${id}/estornar`, { motivo: "erro de novo" }).expect(200);

      const movs = await movimentos(id);
      expect(movs.filter((m) => m.tipo === "pagamento")).toHaveLength(2);
      expect(movs.filter((m) => m.tipo === "estorno")).toHaveLength(2);
      await request(app).delete(`/api/pagamentos/${id}`).set("Authorization", auth).expect(204);
    });

    it("sem pagamento nao ha o que estornar (409); motivo eh obrigatorio (400)", async () => {
      const pendente = await novoPagamento(100);
      const res = await post(`/api/pagamentos/${pendente}/estornar`, { motivo: "x" });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("NADA_A_ESTORNAR");

      const pago = await novoPagamento(100);
      await post(`/api/pagamentos/${pago}/pagar`, { metodo: "pix" }).expect(200);
      expect((await post(`/api/pagamentos/${pago}/estornar`, {})).status).toBe(400);
      expect((await post(`/api/pagamentos/${pago}/estornar`, { motivo: "   " })).status).toBe(400);
      expect((await movimentos(pago)).filter((m) => m.tipo === "estorno")).toHaveLength(0);
    });

    it("dois estornos simultaneos: so um acontece", async () => {
      const id = await novoPagamento(100);
      await post(`/api/pagamentos/${id}/pagar`, { metodo: "pix" }).expect(200);

      const [a, b] = await Promise.all([
        post(`/api/pagamentos/${id}/estornar`, { motivo: "a" }),
        post(`/api/pagamentos/${id}/estornar`, { motivo: "b" }),
      ]);

      expect([a.status, b.status].sort()).toEqual([200, 409]);
      expect((await movimentos(id)).filter((m) => m.tipo === "estorno")).toHaveLength(1);
    });

    it("exige financeiro:delete (403 sem a permissao)", async () => {
      const id = await novoPagamento(100);
      await post(`/api/pagamentos/${id}/pagar`, { metodo: "pix" }).expect(200);

      const res = await post(`/api/pagamentos/${id}/estornar`, { motivo: "x" }, authSemDelete);

      expect(res.status).toBe(403);
      expect((await prisma.pagamento.findUniqueOrThrow({ where: { id } })).status).toBe("pago");
    });

    it("cada parcela eh independente: estornar uma nao mexe nas outras", async () => {
      const pai = await novoPagamento(100);
      const { parcelas } = (await post(`/api/pagamentos/${pai}/parcelar`, { total_parcelas: 2, data_primeira_parcela: "2026-06-01" }).expect(201)).body;
      for (const p of parcelas) await post(`/api/pagamentos/${p.id}/pagar`, { metodo: "pix" }).expect(200);

      await post(`/api/pagamentos/${parcelas[0].id}/estornar`, { motivo: "parcela errada" }).expect(200);

      const [p0, p1] = await Promise.all(parcelas.map((p: any) => prisma.pagamento.findUniqueOrThrow({ where: { id: p.id } })));
      expect([p0.status, p1.status]).toEqual(["pendente", "pago"]);
      expect(await movimentos(parcelas[1].id)).toHaveLength(1);
    });

    it("titulo de outra oficina eh 404", async () => {
      const outra = await prisma.oficina.create({
        data: { nome: `Outra ${suffix}`, logradouro: "R", numero: "1", cep: "00000000", cidade_id: cidadeId },
      });
      try {
        const token = "Bearer " + jwt.sign({ id: usuarioId, tipo: "gestoroficina", oficinaId: outra.id, permissoes: { financeiro: todas } }, getJwtSecret(), { expiresIn: "5m" });
        const id = await novoPagamento(100);
        await post(`/api/pagamentos/${id}/pagar`, { metodo: "pix" }).expect(200);

        expect((await post(`/api/pagamentos/${id}/estornar`, { motivo: "x" }, token)).status).toBe(404);
        expect((await request(app).get(`/api/pagamentos/${id}/movimentos`).set("Authorization", token)).status).toBe(404);
      } finally {
        await prisma.oficina.delete({ where: { id: outra.id } });
      }
    });

    it("GET /movimentos devolve o historico em ordem, com o nome de quem fez", async () => {
      const id = await novoPagamento(100);
      await post(`/api/pagamentos/${id}/pagar`, { metodo: "pix" }).expect(200);
      await post(`/api/pagamentos/${id}/estornar`, { motivo: "teste" }).expect(200);

      const res = await request(app).get(`/api/pagamentos/${id}/movimentos`).set("Authorization", auth);

      expect(res.status).toBe(200);
      expect(res.body.map((m: any) => m.tipo)).toEqual(["pagamento", "estorno"]);
      expect(res.body[1]).toMatchObject({ motivo: "teste", usuario: { id: usuarioId, nome: "Gestor Estorno" } });
    });
  });

  describe("pagar com valor editavel (recebimento parcial pelo mesmo endpoint)", () => {
    const pagar = (id: number, body: object) =>
      request(app).post(`/api/pagamentos/${id}/pagar`).set("Authorization", auth).send(body);

    it("sem valor quita o saldo inteiro", async () => {
      const id = await novoPagamento(100);
      const res = await pagar(id, { metodo: "pix" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("pago");
      expect(Number(res.body.valor_pago)).toBe(100);
    });

    it("valor menor que o saldo recebe parcialmente; o resto quita depois", async () => {
      const id = await novoPagamento(100);

      const parcial = await pagar(id, { metodo: "dinheiro", valor: 40 });
      expect(parcial.status).toBe(200);
      expect(parcial.body.status).toBe("parcial");
      expect(Number(parcial.body.valor_pago)).toBe(40);
      expect(parcial.body.data_pagamento).toBeNull();

      const resto = await pagar(id, { metodo: "pix" });
      expect(resto.body.status).toBe("pago");
      expect(Number(resto.body.valor_pago)).toBe(100);

      const movs = await prisma.pagamento_movimento.findMany({ where: { pagamento_id: id }, orderBy: { id: "asc" } });
      expect(movs.map((m) => Number(m.valor))).toEqual([40, 60]);
    });

    it("valor igual ao saldo quita; valor maior, zero, negativo ou texto sao rejeitados", async () => {
      const id = await novoPagamento(100);
      expect((await pagar(id, { metodo: "pix", valor: 100.01 })).status).toBe(400);
      expect((await pagar(id, { metodo: "pix", valor: 0 })).status).toBe(400);
      expect((await pagar(id, { metodo: "pix", valor: -5 })).status).toBe(400);
      expect((await pagar(id, { metodo: "pix", valor: "abc" })).status).toBe(400);

      const ok = await pagar(id, { metodo: "pix", valor: 100 });
      expect(ok.status).toBe(200);
      expect(ok.body.status).toBe("pago");
    });

    it("o valor eh limitado ao saldo restante depois de um parcial, considerando desconto", async () => {
      const id = await novoPagamento(100);
      await request(app).post(`/api/pagamentos/${id}/desconto`).set("Authorization", auth).send({ desconto: 20, motivo_desconto: "x" }).expect(200);
      await pagar(id, { metodo: "pix", valor: 30 }).then((r) => expect(r.status).toBe(200));

      expect((await pagar(id, { metodo: "pix", valor: 51 })).status).toBe(400); // saldo = 100 - 20 - 30 = 50
      const fim = await pagar(id, { metodo: "pix", valor: 50 });
      expect(fim.body.status).toBe("pago");
    });

    it("duas baixas parciais simultaneas nunca passam do saldo", async () => {
      const id = await novoPagamento(100);
      const rs = await Promise.all([pagar(id, { metodo: "pix", valor: 70 }), pagar(id, { metodo: "pix", valor: 70 })]);

      expect(rs.map((r) => r.status).sort()).toEqual([200, 400]);
      expect(Number((await prisma.pagamento.findUniqueOrThrow({ where: { id } })).valor_pago)).toBe(70);
    });
  });

  describe("respostas das acoes trazem cliente/fornecedor (o front substitui a linha pela resposta)", () => {
    it("criar, pagar parcial, estornar, desconto, renegociar e parcelar mantem o cliente", async () => {
      const criar = await request(app)
        .post("/api/pagamentos")
        .set("Authorization", auth)
        .send({ tipo: "receber", valor: 100, cliente_id: clienteId, data_vencimento: "2026-08-01" });
      expect(criar.body.cliente).toMatchObject({ id: clienteId, nome: "Cliente Atom" });
      const id = criar.body.id;
      const post = (path: string, body: object) => request(app).post(`/api/pagamentos/${id}${path}`).set("Authorization", auth).send(body);

      expect((await post("/pagar", { metodo: "pix", valor: 10 })).body.cliente?.id).toBe(clienteId);
      expect((await post("/estornar", { motivo: "teste" })).body.cliente?.id).toBe(clienteId);
      expect((await post("/desconto", { desconto: 5, motivo_desconto: "x" })).body.cliente?.id).toBe(clienteId);
      expect((await post("/renegociar", { nova_data_vencimento: "2026-09-01" })).body.cliente?.id).toBe(clienteId);
      const parcelar = await post("/parcelar", { total_parcelas: 2, data_primeira_parcela: "2026-10-01" });
      expect(parcelar.body.parcelas.every((p: any) => p.cliente?.id === clienteId)).toBe(true);
    });
  });
});
