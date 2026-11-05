import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";
import { criarUsuarioComAcesso, removerUsuario } from "./sessao.js";

const suffix = Date.now();
const todas = ["read", "create", "update", "delete"];

/** NF-e mínima com um item; qCom vem com 4 casas, como nas notas reais. */
const xmlNota = (chave: string, descricao: string, qCom: string, uCom: string) => `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc><NFe><infNFe Id="NFe${chave}">
  <ide><nNF>123</nNF><serie>1</serie><dhEmi>2026-11-03T10:00:00-03:00</dhEmi></ide>
  <emit><CNPJ>12345678000199</CNPJ><xNome>Distribuidora ${suffix}</xNome></emit>
  <det nItem="1"><prod><cProd>OL1</cProd><xProd>${descricao}</xProd><NCM>27101932</NCM>
    <uCom>${uCom}</uCom><qCom>${qCom}</qCom><vUnCom>40.0000</vUnCom><vProd>100.00</vProd></prod></det>
  <total><ICMSTot><vNF>100.00</vNF></ICMSTot></total>
</infNFe></NFe></nfeProc>`;

describe.skipIf(!process.env.DATABASE_URL)("quantidade decimal (A1)", () => {
  let cidadeId: number;
  let oficinaId: number;
  let clienteId: number;
  let veiculoId: number;
  let funcionarioId: number;
  let fornecedorId: number;
  let usuarioId: number;
  let auth: string;

  const estoqueDe = async (id: number) => Number((await prisma.peca.findUniqueOrThrow({ where: { id } })).estoque);
  const novaPeca = async (estoque: number, unidade = "L") =>
    (
      await prisma.peca.create({
        data: { oficina_id: oficinaId, nome: `Óleo ${suffix}-${Math.random()}`, preco_custo: 20, preco_venda: 40, estoque, unidade },
      })
    ).id;

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Qtd ${suffix}`, uf: "SP" } })).id;
    oficinaId = (
      await prisma.oficina.create({
        data: { nome: `Oficina Qtd ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId },
      })
    ).id;
    clienteId = (await prisma.cliente.create({ data: { nome: "Cliente Qtd", oficina_id: oficinaId } })).id;
    veiculoId = (
      await prisma.veiculo.create({
        data: { marca: "Fiat", modelo: "Uno", placa: `QTD${suffix % 10000}`, oficina_id: oficinaId, cliente_id: clienteId },
      })
    ).id;
    funcionarioId = (
      await prisma.funcionario.create({ data: { nome: "Mecânico", cargo: "mecanico", data_contratacao: new Date(), oficina_id: oficinaId } })
    ).id;
    fornecedorId = (await prisma.fornecedor.create({ data: { nome: `Distribuidora ${suffix}`, oficina_id: oficinaId } })).id;
    usuarioId = await criarUsuarioComAcesso([oficinaId], "qtd", "Gestor Qtd");
    auth =
      "Bearer " +
      jwt.sign(
        {
          id: usuarioId, email: "g@example.com", nome: "Gestor", tipo: "gestoroficina", oficinaId,
          permissoes: { ordens: todas, orcamentos: todas, estoque: todas, fornecedores: todas },
        },
        getJwtSecret(),
        { expiresIn: "5m" }
      );
  });

  afterAll(async () => {
    await prisma.item_orcamento.deleteMany({ where: { orcamento: { cliente_id: clienteId } } });
    await prisma.orcamento.deleteMany({ where: { cliente_id: clienteId } });
    await prisma.item_ordem_servico.deleteMany({ where: { ordem_servico: { oficina_id: oficinaId } } });
    await prisma.ordem_servico.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.compra_peca.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.nota_fiscal_importada.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.peca.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.fornecedor.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.funcionario.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.veiculo.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.cliente.deleteMany({ where: { oficina_id: oficinaId } });
    await removerUsuario(usuarioId);
    await prisma.oficina.deleteMany({ where: { id: oficinaId } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  it("OS com 3,5 L de óleo: subtotal certo, estoque baixa 3,5 e cancelar devolve 3,5", async () => {
    const pecaId = await novaPeca(10);
    const criada = await request(app)
      .post("/api/ordens")
      .set("Authorization", auth)
      .send({
        cliente_id: clienteId,
        veiculo_id: veiculoId,
        funcionario_id: funcionarioId,
        itens: [{ tipo_item: "peca", peca_id: pecaId, quantidade: "3,5", preco_unitario: 39.9 }],
      });

    expect(criada.status).toBe(201);
    expect(Number(criada.body.itens[0].quantidade)).toBe(3.5);
    expect(Number(criada.body.itens[0].subtotal)).toBe(139.65);
    expect(Number(criada.body.valor_total)).toBe(139.65);
    expect(await estoqueDe(pecaId)).toBe(6.5);

    await request(app).put(`/api/ordens/${criada.body.id}`).set("Authorization", auth).send({ status: "cancelada" }).expect(200);
    expect(await estoqueDe(pecaId)).toBe(10);
  });

  it("OS recusa quantidade com mais de 3 casas e não mexe no estoque", async () => {
    const pecaId = await novaPeca(10);
    const res = await request(app)
      .post("/api/ordens")
      .set("Authorization", auth)
      .send({
        cliente_id: clienteId, veiculo_id: veiculoId, funcionario_id: funcionarioId,
        itens: [{ tipo_item: "peca", peca_id: pecaId, quantidade: 1.2345, preco_unitario: 10 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("QUANTIDADE_INVALIDA");
    expect(await estoqueDe(pecaId)).toBe(10);
  });

  it("estoque insuficiente avisa o disponível com a unidade", async () => {
    const pecaId = await novaPeca(2);
    const res = await request(app)
      .post("/api/ordens")
      .set("Authorization", auth)
      .send({
        cliente_id: clienteId, veiculo_id: veiculoId, funcionario_id: funcionarioId,
        itens: [{ tipo_item: "peca", peca_id: pecaId, quantidade: 2.5, preco_unitario: 10 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Disponível: 2 L");
  });

  it("orçamento com 1,5 × R$ 10,00 = R$ 15,00", async () => {
    const res = await request(app)
      .post("/api/orcamentos")
      .set("Authorization", auth)
      .send({
        clienteId, veiculoId, descricao: "Troca de óleo", valor: 1, data: "2026-11-03",
        itens: [{ tipo_item: "servico", nome: "Mão de obra", quantidade: 1.5, preco_unitario: 10, subtotal: 1 }],
      });

    expect(res.status).toBe(201);
    expect(Number(res.body.itens[0].quantidade)).toBe(1.5);
    expect(Number(res.body.itens[0].subtotal)).toBe(15);
    expect(Number(res.body.valor)).toBe(15);

    const zero = await request(app)
      .post("/api/orcamentos")
      .set("Authorization", auth)
      .send({ clienteId, veiculoId, descricao: "X", valor: 1, data: "2026-11-03", itens: [{ tipo_item: "servico", nome: "X", quantidade: 0, preco_unitario: 10 }] });
    expect(zero.status).toBe(400);
    expect(zero.body.code).toBe("QUANTIDADE_INVALIDA");
  });

  it("orçamento sem itens exige valor maior que zero", async () => {
    const criar = (valor: unknown) =>
      request(app)
        .post("/api/orcamentos")
        .set("Authorization", auth)
        .send({ clienteId, veiculoId, descricao: "Valor manual", valor, data: "2026-11-03", itens: [] });

    for (const invalido of [-50, 0, "abc", undefined]) {
      const res = await criar(invalido);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALOR_INVALIDO");
    }

    const ok = await criar(200);
    expect(ok.status).toBe(201);
    expect(Number(ok.body.valor)).toBe(200);
  });

  it("ajuste de estoque aceita fração e compara Decimal na saída", async () => {
    const pecaId = await novaPeca(1);
    const ajuste = (tipo: string, quantidade: unknown) =>
      request(app).patch(`/api/pecas/${pecaId}/ajuste`).set("Authorization", auth).send({ tipo, quantidade });

    expect((await ajuste("entrada", "0,75")).status).toBe(200);
    expect(await estoqueDe(pecaId)).toBe(1.75);

    const demais = await ajuste("saida", 1.8);
    expect(demais.status).toBe(400);
    expect(demais.body.error).toContain("1,75 L");

    expect((await ajuste("saida", 1.75)).status).toBe(200);
    expect(await estoqueDe(pecaId)).toBe(0);
    expect((await ajuste("entrada", 0)).status).toBe(400);
  });

  it("cadastro de peça grava unidade e estoque fracionado; unidade inválida dá 400", async () => {
    const ok = await request(app)
      .post("/api/pecas")
      .set("Authorization", auth)
      .send({ nome: `Fluido ${suffix}`, preco_custo: 10, preco_venda: 20, estoque: "4,5", unidade: "l" });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ unidade: "L" });
    expect(Number(ok.body.estoque)).toBe(4.5);

    const ruim = await request(app)
      .post("/api/pecas")
      .set("Authorization", auth)
      .send({ nome: `Caixa ${suffix}`, preco_custo: 10, preco_venda: 20, estoque: 1, unidade: "CX" });
    expect(ruim.status).toBe(400);
    expect(ruim.body.code).toBe("UNIDADE_INVALIDA");

    const editada = await request(app).put(`/api/pecas/${ok.body.id}`).set("Authorization", auth).send({ unidade: "KG", estoque: 0.25 });
    expect(editada.status).toBe(200);
    expect(editada.body.unidade).toBe("KG");
    expect(Number(editada.body.estoque)).toBe(0.25);
  });

  it("importação de XML com qCom 2.5 incrementa o estoque em 2,5", async () => {
    const pecaId = await novaPeca(1);
    const chave = `35261112345678000199550010000001231${String(suffix).slice(-9)}`;
    const preview = await request(app)
      .post("/api/importarxml/preview")
      .set("Authorization", auth)
      .attach("arquivo", Buffer.from(xmlNota(chave, "Óleo 5W30", "2.5000", "LT")), "nota.xml");

    expect(preview.status).toBe(200);
    expect(preview.body.itens[0]).toMatchObject({ quantidade: 2.5, unidade: "LT" });

    const item = preview.body.itens[0];
    const confirmar = await request(app)
      .post("/api/importarxml/confirmar")
      .set("Authorization", auth)
      .send({
        ...preview.body,
        fornecedor_id: fornecedorId,
        itens: [{ descricao: item.descricao, quantidade: item.quantidade, unidade: item.unidade, valor_unitario: 40, preco_venda: 60, acao: "vincular", peca_id: pecaId }],
      });

    expect(confirmar.status).toBe(200);
    expect(await estoqueDe(pecaId)).toBe(3.5);
    const compra = await prisma.compra_peca.findFirstOrThrow({ where: { peca_id: pecaId } });
    expect(Number(compra.quantidade)).toBe(2.5);
  });

  it("importação cria peça nova com a unidade da nota (LT → L)", async () => {
    const descricao = `Aditivo ${suffix}`;
    const res = await request(app)
      .post("/api/importarxml/confirmar")
      .set("Authorization", auth)
      .send({
        chave_acesso: `nova-${suffix}`, numero_nota: "9", serie: "1", data_emissao: "2026-11-03", fornecedor_id: null,
        fornecedor_nome: "X", valor_total: 30,
        itens: [{ descricao, quantidade: 1.25, unidade: "LT", valor_unitario: 20, preco_venda: 30, acao: "nova_peca" }],
      });

    expect(res.status).toBe(200);
    const peca = await prisma.peca.findFirstOrThrow({ where: { nome: descricao, oficina_id: oficinaId } });
    expect(peca.unidade).toBe("L");
    expect(Number(peca.estoque)).toBe(1.25);
  });

  it("importação não incrementa peça de outra oficina", async () => {
    const outra = await prisma.oficina.create({
      data: { nome: `Outra Qtd ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId },
    });
    const alheia = await prisma.peca.create({ data: { oficina_id: outra.id, nome: `Alheia ${suffix}`, preco_custo: 1, preco_venda: 2, estoque: 5 } });
    try {
      const res = await request(app)
        .post("/api/importarxml/confirmar")
        .set("Authorization", auth)
        .send({
          chave_acesso: `alheia-${suffix}`, numero_nota: "8", serie: "1", data_emissao: "2026-11-03", fornecedor_id: null,
          fornecedor_nome: "X", valor_total: 10,
          itens: [{ descricao: "Peça", quantidade: 3, valor_unitario: 1, preco_venda: 2, acao: "vincular", peca_id: alheia.id }],
        });

      expect(res.status).toBe(422);
      expect(await estoqueDe(alheia.id)).toBe(5);
    } finally {
      await prisma.peca.delete({ where: { id: alheia.id } });
      await prisma.oficina.delete({ where: { id: outra.id } });
    }
  });
});
