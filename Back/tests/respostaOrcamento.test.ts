import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";
import { NotificacoesService } from "../src/services/notificacoes.service.js";
import { orcamentoVencido } from "../src/services/publicTracking.service.js";
import { hojeISO } from "../src/utils/datas.js";
import { criarUsuarioComAcesso, removerUsuario } from "./sessao.js";

const suffix = Date.now();
const permissoes = {
  orcamentos: ["read", "create", "update", "delete"],
  ordens: ["read", "create", "update", "delete"],
  configuracoes: ["read", "update"],
};

describe("orcamentoVencido (validade só-dia, fuso da oficina)", () => {
  it("vale até o fim do dia da validade", () => {
    const validade = new Date("2026-11-10T00:00:00.000Z");
    expect(orcamentoVencido(validade, "2026-11-09")).toBe(false);
    expect(orcamentoVencido(validade, "2026-11-10")).toBe(false);
    expect(orcamentoVencido(validade, "2026-11-11")).toBe(true);
    expect(orcamentoVencido(null, "2030-01-01")).toBe(false);
  });
});

describe.skipIf(!process.env.DATABASE_URL)("cliente responde o orçamento pelo link público (B1)", () => {
  let cidadeId: number;
  let oficinaId: number;
  let clienteId: number;
  let veiculoId: number;
  let funcionarioId: number;
  let usuarioId: number;
  let token: string;
  const orcamentos: number[] = [];
  let osId: number;

  const hoje = hojeISO();
  const diaUtc = (dias: number) => {
    const d = new Date(`${hoje}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    return d;
  };

  async function novoOrcamento(extra: { validade?: Date | null; deleted_at?: Date } = {}) {
    const orc = await prisma.orcamento.create({
      data: {
        descricao: "Revisão",
        valor: 350,
        data: new Date(),
        validade: extra.validade === undefined ? diaUtc(7) : extra.validade,
        oficina_id: oficinaId,
        cliente_id: clienteId,
        veiculo_id: veiculoId,
        deleted_at: extra.deleted_at,
      },
    });
    orcamentos.push(orc.id);
    const link = await prisma.link_publico.create({ data: { oficina_id: oficinaId, orcamento_id: orc.id } });
    return { id: orc.id, code: link.id };
  }

  const aprovar = (code: string, body: object = {}) => request(app).post(`/api/public/acompanhamento/${code}/aprovar`).send(body);
  const recusar = (code: string, body: object = {}) => request(app).post(`/api/public/acompanhamento/${code}/recusar`).send(body);

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade B1 ${suffix}`, uf: "SP" } })).id;
    oficinaId = (
      await prisma.oficina.create({
        data: { nome: `Oficina B1 ${suffix}`, logradouro: "Rua Teste", numero: "1", cep: "00000000", cidade_id: cidadeId },
      })
    ).id;
    clienteId = (await prisma.cliente.create({ data: { nome: "Cliente B1", oficina_id: oficinaId } })).id;
    veiculoId = (
      await prisma.veiculo.create({ data: { marca: "Fiat", modelo: "Uno", placa: `BUM${suffix % 10000}`, oficina_id: oficinaId, cliente_id: clienteId } })
    ).id;
    funcionarioId = (
      await prisma.funcionario.create({ data: { nome: "Mecanico", cargo: "mecanico", data_contratacao: new Date(), oficina_id: oficinaId } })
    ).id;
    osId = (
      await prisma.ordem_servico.create({ data: { oficina_id: oficinaId, cliente_id: clienteId, veiculo_id: veiculoId, funcionario_id: funcionarioId } })
    ).id;
    usuarioId = await criarUsuarioComAcesso([oficinaId], "b1");
    token = jwt.sign(
      { id: usuarioId, email: "gestor@example.com", nome: "Gestor", tipo: "gestoroficina", oficinaId, permissoes },
      getJwtSecret(),
      { expiresIn: "5m" }
    );
  });

  afterAll(async () => {
    await removerUsuario(usuarioId);
    await prisma.link_publico.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.orcamento.deleteMany({ where: { id: { in: orcamentos } } });
    await prisma.ordem_servico.deleteMany({ where: { id: osId } });
    await prisma.funcionario.deleteMany({ where: { id: funcionarioId } });
    await prisma.veiculo.deleteMany({ where: { id: veiculoId } });
    await prisma.cliente.deleteMany({ where: { id: clienteId } });
    await prisma.oficina.deleteMany({ where: { id: oficinaId } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  it("acompanhamento de orçamento em análise permite responder", async () => {
    const { code } = await novoOrcamento();
    const { body } = await request(app).get(`/api/public/acompanhamento/${code}`);
    expect(body).toMatchObject({ type: "orcamento", status: "analise", podeResponder: true, vencido: false, resposta: null });
  });

  it("aprovar orçamento em análise: 200, status aprovado e campos gravados", async () => {
    const { id, code } = await novoOrcamento();
    const res = await aprovar(code, { nome: "  Ana Souza  " });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "aprovado", podeResponder: false, resposta: { decisao: "aprovado", nome: "Ana Souza", motivo: null } });
    expect(res.body.resposta.em).toBeTruthy();

    const row = await prisma.orcamento.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("aprovado");
    expect(row.respondido_pelo_cliente).toBe(true);
    expect(row.respondido_por_nome).toBe("Ana Souza");
    expect(row.respondido_em).toBeInstanceOf(Date);
    expect(row.respondido_ip).toBeTruthy();
    expect(row.motivo_recusa).toBeNull();
  });

  it("recusar grava o motivo; nome em branco vira null", async () => {
    const { id, code } = await novoOrcamento();
    const res = await recusar(code, { nome: "   ", motivo: "Vou fazer em outro lugar." });

    expect(res.status).toBe(200);
    expect(res.body.resposta).toMatchObject({ decisao: "recusado", nome: null, motivo: "Vou fazer em outro lugar." });
    const row = await prisma.orcamento.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: "recusado", respondido_pelo_cliente: true, respondido_por_nome: null, motivo_recusa: "Vou fazer em outro lugar." });
  });

  it("motivo acima de 500 caracteres: 400 e nada muda", async () => {
    const { id, code } = await novoOrcamento();
    const res = await recusar(code, { motivo: "x".repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MOTIVO_INVALIDO");
    expect((await prisma.orcamento.findUniqueOrThrow({ where: { id } })).status).toBe("analise");
  });

  it("segunda resposta: 409", async () => {
    const { code } = await novoOrcamento();
    expect((await aprovar(code)).status).toBe(200);

    const denovo = await recusar(code, { motivo: "mudei de ideia" });
    expect(denovo.status).toBe(409);
    expect(denovo.body.code).toBe("ORCAMENTO_JA_RESPONDIDO");
  });

  it("orçamento vencido: 409 e o acompanhamento não oferece resposta", async () => {
    const { id, code } = await novoOrcamento({ validade: diaUtc(-1) });
    const res = await aprovar(code);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ORCAMENTO_VENCIDO");
    expect((await prisma.orcamento.findUniqueOrThrow({ where: { id } })).status).toBe("analise");

    const { body } = await request(app).get(`/api/public/acompanhamento/${code}`);
    expect(body).toMatchObject({ vencido: true, podeResponder: false });
  });

  it("validade hoje ainda aceita resposta", async () => {
    const { code } = await novoOrcamento({ validade: diaUtc(0) });
    expect((await aprovar(code)).status).toBe(200);
  });

  it("link de OS, link cancelado, orçamento excluído ou código inválido: 404", async () => {
    const linkOs = await prisma.link_publico.create({ data: { oficina_id: oficinaId, ordem_servico_id: osId } });
    expect((await aprovar(linkOs.id)).status).toBe(404);

    const { code } = await novoOrcamento();
    await prisma.link_publico.update({ where: { id: code }, data: { status: "cancelado", deleted_at: new Date() } });
    expect((await aprovar(code)).status).toBe(404);

    const excluido = await novoOrcamento({ deleted_at: new Date() });
    expect((await aprovar(excluido.code)).status).toBe(404);

    expect((await aprovar("nao-e-uuid")).status).toBe(404);
  });

  it("duas aprovações simultâneas: só uma passa", async () => {
    const { code } = await novoOrcamento();
    const respostas = await Promise.all([aprovar(code, { nome: "A" }), aprovar(code, { nome: "B" }), recusar(code)]);
    const status = respostas.map((r) => r.status).sort();
    expect(status).toEqual([200, 409, 409]);
  });

  it("a oficina vê a notificação da resposta do cliente", async () => {
    const { id, code } = await novoOrcamento();
    await recusar(code, { motivo: "caro" });

    const lista = await NotificacoesService.list(oficinaId, permissoes);
    const item = lista.find((n) => n.id === `orcamento-resposta-${id}-recusado`);
    expect(item).toMatchObject({ tipo: "orcamentos", severidade: "warning", rota: `/orcamentos/${id}` });
    expect(item?.titulo).toBe(`Cliente recusou ORC #${String(id).padStart(3, "0")}`);

    // Sem permissão de orçamentos, não aparece.
    const semPermissao = await NotificacoesService.list(oficinaId, { ordens: ["read"] });
    expect(semPermissao.some((n) => n.id.startsWith("orcamento-resposta-"))).toBe(false);
  });

  it("WhatsApp da oficina: salvo em Minha empresa (só dígitos) e enviado ao link público", async () => {
    const auth = `Bearer ${token}`;
    const ok = await request(app).patch("/api/oficinas/minha").set("Authorization", auth).send({ whatsapp: "(11) 9 8765-4321" });
    expect(ok.status).toBe(200);
    expect(ok.body.whatsapp).toBe("11987654321");

    const ruim = await request(app).patch("/api/oficinas/minha").set("Authorization", auth).send({ whatsapp: "1234" });
    expect(ruim.status).toBe(400);

    const { code } = await novoOrcamento();
    const { body } = await request(app).get(`/api/public/acompanhamento/${code}`);
    expect(body.oficina.whatsapp).toBe("11987654321");

    expect((await request(app).patch("/api/oficinas/minha").set("Authorization", auth).send({ whatsapp: "" })).body.whatsapp).toBeNull();
  });

  it("a oficina trocando a situação desfaz a resposta do cliente; gerar OS mantém", async () => {
    const aprovado = await novoOrcamento();
    await aprovar(aprovado.code, { nome: "Ana" });

    // Mesma situação (ex.: gerar O.S. marca aprovado de novo): mantém o selo.
    await request(app).patch(`/api/orcamentos/${aprovado.id}/status`).set("Authorization", `Bearer ${token}`).send({ status: "aprovado" });
    expect((await prisma.orcamento.findUniqueOrThrow({ where: { id: aprovado.id } })).respondido_pelo_cliente).toBe(true);

    const res = await request(app).patch(`/api/orcamentos/${aprovado.id}/status`).set("Authorization", `Bearer ${token}`).send({ status: "recusado" });
    expect(res.status).toBe(200);
    const row = await prisma.orcamento.findUniqueOrThrow({ where: { id: aprovado.id } });
    expect(row).toMatchObject({ status: "recusado", respondido_pelo_cliente: false, respondido_em: null, respondido_por_nome: null });

    const { body } = await request(app).get(`/api/public/acompanhamento/${aprovado.code}`);
    expect(body.resposta).toBeNull();
  });
});
