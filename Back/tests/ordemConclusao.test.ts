import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";
import { criarUsuarioComAcesso, removerUsuario } from "./sessao.js";

const suffix = Date.now();
const todas = ["read", "create", "update", "delete"];

describe.skipIf(!process.env.DATABASE_URL)("OS: conta gerada na conclusão e itens", () => {
  let cidadeId: number;
  let oficinaId: number;
  let clienteId: number;
  let veiculoId: number;
  let funcionarioId: number;
  let usuarioId: number;
  let auth: string;

  const criarOs = (itens: object[]) =>
    request(app)
      .post("/api/ordens")
      .set("Authorization", auth)
      .send({ cliente_id: clienteId, veiculo_id: veiculoId, funcionario_id: funcionarioId, itens });
  const status = (id: number, s: string) => request(app).put(`/api/ordens/${id}`).set("Authorization", auth).send({ status: s });

  beforeAll(async () => {
    // 23:30 de 30/10 em Brasília: em UTC já é 31/10.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-31T02:30:00Z") });

    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade OS ${suffix}`, uf: "SP" } })).id;
    oficinaId = (
      await prisma.oficina.create({ data: { nome: `Oficina OS ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId } })
    ).id;
    clienteId = (await prisma.cliente.create({ data: { nome: "Cliente OS", oficina_id: oficinaId } })).id;
    veiculoId = (
      await prisma.veiculo.create({ data: { marca: "Fiat", modelo: "Uno", placa: `OSC${suffix % 10000}`, oficina_id: oficinaId, cliente_id: clienteId } })
    ).id;
    funcionarioId = (
      await prisma.funcionario.create({ data: { nome: "Mecanico OS", cargo: "mecanico", data_contratacao: new Date(), oficina_id: oficinaId } })
    ).id;
    usuarioId = await criarUsuarioComAcesso([oficinaId], "os-conclusao");
    auth =
      "Bearer " +
      jwt.sign(
        {
          id: usuarioId, email: "os@example.com", nome: "OS", tipo: "gestoroficina", oficinaId, tv: 0,
          permissoes: { ordens: todas, financeiro: todas, painel: ["read"] },
        },
        getJwtSecret(),
        { expiresIn: "5m" }
      );
  });

  afterAll(async () => {
    vi.useRealTimers();
    await prisma.pagamento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.item_ordem_servico.deleteMany({ where: { ordem_servico: { oficina_id: oficinaId } } });
    await prisma.ordem_servico.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.funcionario.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.veiculo.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.cliente.deleteMany({ where: { oficina_id: oficinaId } });
    await removerUsuario(usuarioId);
    await prisma.oficina.deleteMany({ where: { id: oficinaId } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  describe("conta gerada na conclusão", () => {
    it("vence no dia de Brasília, diz de qual OS veio e entra em 'A receber hoje'", async () => {
      const criada = await criarOs([{ tipo_item: "servico", nome: "Revisão", quantidade: 1, preco_unitario: 150, subtotal: 150 }]);
      expect(criada.status).toBe(201);
      const osId = criada.body.id as number;

      expect((await status(osId, "em_andamento")).status).toBe(200);
      expect((await status(osId, "concluida")).status).toBe(200);

      const conta = await prisma.pagamento.findFirstOrThrow({ where: { ordem_servico_id: osId } });
      expect(conta.data_vencimento.toISOString()).toBe("2026-10-30T00:00:00.000Z");
      expect(conta.data_vencimento_original!.toISOString()).toBe("2026-10-30T00:00:00.000Z");
      expect(conta.descricao).toBe(`OS #${osId}`);

      const painel = await request(app).get("/api/painel/resumo").set("Authorization", auth);
      expect(painel.status).toBe(200);
      expect(painel.body.financeiro.a_receber_hoje).toBe(150);
    });
  });

  describe("itens", () => {
    it("recusa item de peça sem peca_id", async () => {
      const res = await criarOs([{ tipo_item: "peca", quantidade: 1, preco_unitario: 35, subtotal: 35 }]);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Selecione a peça do estoque para o item de peça.");
    });

    it("recusa item de peça sem peca_id também ao editar", async () => {
      const criada = await criarOs([{ tipo_item: "servico", nome: "Mão de obra", quantidade: 1, preco_unitario: 80, subtotal: 80 }]);
      const res = await request(app)
        .put(`/api/ordens/${criada.body.id}`)
        .set("Authorization", auth)
        .send({ itens: [{ tipo_item: "peca", quantidade: 1, preco_unitario: 35, subtotal: 35 }] });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Selecione a peça do estoque para o item de peça.");
    });

    it("aceita item de serviço sem servico_id (orçamento convertido)", async () => {
      const res = await criarOs([{ tipo_item: "servico", nome: "Orçamento #1", quantidade: 1, preco_unitario: 950, subtotal: 950 }]);
      expect(res.status).toBe(201);
    });
  });
});
