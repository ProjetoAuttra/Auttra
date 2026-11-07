import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";
import { calcularAssinatura, fimDoTeste, limparCacheAssinatura, type DadosAssinatura } from "../src/services/assinatura.service.js";
import { filtroSituacao } from "../src/services/admin/oficinas.service.js";
import { LinksPublicosService } from "../src/services/linksPublicos.service.js";
import { limparCacheSessoes } from "../src/services/sessao.service.js";
import { assinaturaSchema } from "../src/schemas/admin/oficinas.schema.js";
import { ADMIN_COOKIE } from "../src/utils/adminCookie.js";
import { fimDoDiaSP, inicioDoDiaSP } from "../src/utils/datas.js";
import { criarUsuarioComAcesso, removerUsuario } from "./sessao.js";

const HORA = 3_600_000;
const DIA = 24 * HORA;

const dados = (extra: Partial<DadosAssinatura>): DadosAssinatura => ({
  assinatura_status: "teste",
  teste_termina_em: null,
  assinatura_plano: null,
  assinatura_ativada_em: null,
  ...extra,
});

describe("calcularAssinatura", () => {
  const agora = new Date("2026-11-06T15:00:00Z");

  it("teste recém-criado: termina às 23:59 (SP) de 7 dias depois e mostra 7 dias", () => {
    const fim = fimDoTeste(agora); // 06/11 12:00 em SP
    expect(fim.toISOString()).toBe("2026-11-14T02:59:59.999Z"); // 13/11 23:59:59.999 em SP
    expect(calcularAssinatura(dados({ teste_termina_em: fim }), agora)).toMatchObject({ situacao: "teste", diasRestantes: 7, somenteLeitura: false });
    // Cadastro às 23:30 de SP: ainda é o mesmo dia, mesma data de fim.
    expect(fimDoTeste(new Date("2026-11-07T02:30:00Z")).toISOString()).toBe("2026-11-14T02:59:59.999Z");
  });

  it("a contagem baixa à meia-noite de SP, não no horário do cadastro", () => {
    const fim = fimDoTeste(agora);
    const dias = (iso: string) => calcularAssinatura(dados({ teste_termina_em: fim }), new Date(iso)).diasRestantes;
    expect(dias("2026-11-07T02:59:00Z")).toBe(7); // 06/11 23:59 em SP
    expect(dias("2026-11-07T03:01:00Z")).toBe(6); // 07/11 00:01 em SP
    expect(dias("2026-11-13T03:00:00Z")).toBe(0); // último dia: 13/11
    expect(calcularAssinatura(dados({ teste_termina_em: fim }), new Date("2026-11-13T23:00:00Z")).situacao).toBe("teste");
    expect(calcularAssinatura(dados({ teste_termina_em: fim }), new Date("2026-11-14T03:00:00Z")).situacao).toBe("teste_vencido");
  });

  it("teste vencido vira só leitura (vence no instante exato)", () => {
    expect(calcularAssinatura(dados({ teste_termina_em: agora }), agora)).toMatchObject({
      situacao: "teste_vencido", diasRestantes: 0, somenteLeitura: true,
    });
    expect(calcularAssinatura(dados({ teste_termina_em: new Date(agora.getTime() - DIA) }), agora).somenteLeitura).toBe(true);
  });

  it("teste sem data de fim conta como vencido (não libera de graça)", () => {
    expect(calcularAssinatura(dados({}), agora)).toMatchObject({ situacao: "teste_vencido", somenteLeitura: true });
  });

  it("ativa libera tudo, mesmo com o teste antigo vencido; suspensa é só leitura", () => {
    const ativa = calcularAssinatura(
      dados({ assinatura_status: "ativa", assinatura_plano: "mensal", teste_termina_em: new Date(agora.getTime() - DIA) }),
      agora
    );
    expect(ativa).toMatchObject({ situacao: "ativa", plano: "mensal", diasRestantes: null, somenteLeitura: false });
    expect(calcularAssinatura(dados({ assinatura_status: "suspensa" }), agora)).toMatchObject({
      situacao: "suspensa", somenteLeitura: true,
    });
  });
});

describe("datas de assinatura em São Paulo", () => {
  it("fim e início do dia em UTC-3", () => {
    expect(fimDoDiaSP("2026-11-20").toISOString()).toBe("2026-11-21T02:59:59.999Z");
    expect(inicioDoDiaSP("2026-11-20").toISOString()).toBe("2026-11-20T03:00:00.000Z");
  });
});

describe("assinaturaSchema (ações do painel)", () => {
  it("ativar exige o plano", () => {
    expect(assinaturaSchema.safeParse({ acao: "ativar", plano: "mensal" }).success).toBe(true);
    const sem = assinaturaSchema.safeParse({ acao: "ativar" });
    expect(sem.success).toBe(false);
    expect(sem.error?.issues[0]?.message).toBe("Escolha o plano: mensal ou semestral.");
  });

  it("estender pede os dias ou a data, não os dois", () => {
    expect(assinaturaSchema.safeParse({ acao: "estender_teste", dias: 7 }).success).toBe(true);
    expect(assinaturaSchema.safeParse({ acao: "estender_teste", termina_em: "2026-12-01" }).success).toBe(true);
    expect(assinaturaSchema.safeParse({ acao: "estender_teste" }).success).toBe(false);
    expect(assinaturaSchema.safeParse({ acao: "estender_teste", dias: 7, termina_em: "2026-12-01" }).success).toBe(false);
    expect(assinaturaSchema.safeParse({ acao: "estender_teste", termina_em: "2026-02-30" }).success).toBe(false);
    expect(assinaturaSchema.safeParse({ acao: "estender_teste", dias: 0 }).success).toBe(false);
  });

  it("recusa ação desconhecida", () => {
    expect(assinaturaSchema.safeParse({ acao: "apagar" }).success).toBe(false);
  });
});

describe("filtroSituacao (listagem do painel)", () => {
  it("separa teste em andamento de teste vencido pela data", () => {
    const agora = new Date("2026-11-06T15:00:00Z");
    expect(filtroSituacao("teste", agora)).toEqual({ assinatura_status: "teste", teste_termina_em: { gt: agora } });
    expect(filtroSituacao("teste_vencido", agora)).toEqual({
      assinatura_status: "teste", OR: [{ teste_termina_em: null }, { teste_termina_em: { lte: agora } }],
    });
    expect(filtroSituacao("suspensa", agora)).toEqual({ assinatura_status: "suspensa" });
  });
});

describe.skipIf(!process.env.DATABASE_URL)("conta só leitura fora do prazo", () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let cidadeId: number;
  let oficinaId: number;
  let antigaId: number;
  let usuarioId: number;
  let adminId: number;
  let orcamentoId: number;
  let codigoLink: string;

  const permissoes = {
    clientes: ["read", "create", "update", "delete"],
    configuracoes: ["read", "update"],
    relatorios: ["read"],
  };
  const tokenDe = (oficina: number) =>
    jwt.sign({ id: usuarioId, email: "u@example.com", nome: "U", tipo: "gestoroficina", oficinaId: oficina, permissoes, tv: 0 }, getJwtSecret(), {
      expiresIn: "5m",
    });
  const cookieAdmin = () =>
    `${ADMIN_COOKIE}=${jwt.sign({ id: adminId, email: "a@example.com", nome: "Admin", tipo: "sistema", tv: 0 }, getJwtSecret(), { expiresIn: "5m" })}`;

  const novoCliente = (oficina = oficinaId) =>
    request(app).post("/api/clientes").set("Authorization", `Bearer ${tokenDe(oficina)}`).send({ nome: `Cliente ${Math.random()}` });
  const alterarAssinatura = (body: Record<string, unknown>) =>
    request(app).patch(`/api/admin/oficinas/${oficinaId}/assinatura`).set("Cookie", cookieAdmin()).send(body);
  const vencerTeste = () =>
    prisma.oficina.update({
      where: { id: oficinaId },
      data: { assinatura_status: "teste", teste_termina_em: new Date(Date.now() - HORA), assinatura_plano: null },
    });

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Assinatura ${suffix}`, uf: "SP" } })).id;
    oficinaId = (await prisma.oficina.create({ data: { nome: `Oficina Teste ${suffix}`, origem: "cadastro" } })).id;
    // Oficina "de antes": criada sem nenhum campo de assinatura, pega o default.
    antigaId = (
      await prisma.oficina.create({ data: { nome: `Oficina Antiga ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId } })
    ).id;
    usuarioId = await criarUsuarioComAcesso([oficinaId, antigaId], "assinatura");
    adminId = (await prisma.usuario.create({ data: { nome: "Admin", email: `admin-assinatura-${suffix}@example.com`, senha: "x", tipo: "sistema" } })).id;

    const clienteId = (await prisma.cliente.create({ data: { nome: "Cliente Link", oficina_id: oficinaId } })).id;
    const veiculoId = (
      await prisma.veiculo.create({ data: { marca: "Fiat", modelo: "Uno", placa: `ASS${Date.now() % 10000}`, oficina_id: oficinaId, cliente_id: clienteId } })
    ).id;
    orcamentoId = (
      await prisma.orcamento.create({
        data: { descricao: "Revisão", valor: 100, data: new Date(), validade: null, oficina_id: oficinaId, cliente_id: clienteId, veiculo_id: veiculoId },
      })
    ).id;
    codigoLink = await LinksPublicosService.obterOuCriar({ orcamentoId }, oficinaId);
  });

  beforeEach(() => {
    limparCacheSessoes();
    limparCacheAssinatura();
  });

  afterAll(async () => {
    await prisma.link_publico.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.orcamento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.veiculo.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.sugestao.deleteMany({ where: { oficina_id: { in: [oficinaId, antigaId] } } });
    await prisma.cliente.deleteMany({ where: { oficina_id: { in: [oficinaId, antigaId] } } });
    await prisma.admin_audit_log.deleteMany({ where: { oficina_id: oficinaId } });
    await removerUsuario(usuarioId);
    await prisma.usuario.deleteMany({ where: { id: adminId } });
    await prisma.oficina.deleteMany({ where: { id: { in: [oficinaId, antigaId] } } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  it("oficina que já existia continua ativa e editando", async () => {
    const res = await request(app).get("/api/assinatura").set("Authorization", `Bearer ${tokenDe(antigaId)}`);
    expect(res.body).toMatchObject({ situacao: "ativa", somenteLeitura: false });
    expect((await novoCliente(antigaId)).status).toBe(201);
  });

  it("durante o teste tudo funciona", async () => {
    await prisma.oficina.update({ where: { id: oficinaId }, data: { assinatura_status: "teste", teste_termina_em: fimDoTeste() } });
    const res = await request(app).get("/api/assinatura").set("Authorization", `Bearer ${tokenDe(oficinaId)}`);
    expect(res.body).toMatchObject({ situacao: "teste", diasRestantes: 7, somenteLeitura: false });
    expect((await novoCliente()).status).toBe(201);
  });

  it("teste vencido: lê tudo, mas escrita recebe 402", async () => {
    await vencerTeste();
    const auth = { Authorization: `Bearer ${tokenDe(oficinaId)}` };

    expect((await request(app).get("/api/clientes").set(auth)).status).toBe(200);
    expect((await request(app).get("/api/assinatura").set(auth)).body).toMatchObject({ situacao: "teste_vencido", somenteLeitura: true });

    const bloqueado = await novoCliente();
    expect(bloqueado.status).toBe(402);
    expect(bloqueado.body).toMatchObject({ code: "ASSINATURA_NECESSARIA", situacao: "teste_vencido" });
    expect(bloqueado.body.message).toMatch(/teste grátis terminou/);

    // Sugestão continua liberada.
    const sugestao = await request(app).post("/api/sugestoes").set(auth).send({ modulo: "clientes", mensagem: "Queria poder exportar clientes." });
    expect(sugestao.status).toBe(201);
  });

  it("teste vencido: o cliente final vê o orçamento, mas não aprova pelo link", async () => {
    await vencerTeste();
    const link = await request(app).get(`/api/public/acompanhamento/${codigoLink}`);
    expect(link.status).toBe(200);
    expect(link.body).toMatchObject({ podeResponder: false, respostaPausada: true });

    const aprovar = await request(app).post(`/api/public/acompanhamento/${codigoLink}/aprovar`).send({});
    expect(aprovar.status).toBe(409);
    expect(aprovar.body.code).toBe("RESPOSTA_PAUSADA");
    expect((await prisma.orcamento.findUniqueOrThrow({ where: { id: orcamentoId } })).status).toBe("analise");
  });

  it("ativar no painel libera na hora, com registro no histórico", async () => {
    await vencerTeste();
    expect((await novoCliente()).status).toBe(402);

    const res = await alterarAssinatura({ acao: "ativar", plano: "semestral" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ situacao: "ativa", plano: "semestral", somenteLeitura: false });

    // Sem limpar o cache à mão: a ação do painel já limpa.
    expect((await novoCliente()).status).toBe(201);
    const link = await request(app).get(`/api/public/acompanhamento/${codigoLink}`);
    expect(link.body).toMatchObject({ podeResponder: true, respostaPausada: false });

    const log = await prisma.admin_audit_log.findFirst({ where: { oficina_id: oficinaId, action: "oficina.assinatura_ativar" }, orderBy: { id: "desc" } });
    expect(log?.message).toMatch(/^Assinatura ativada: plano semestral/);
  });

  it("estender o teste vencido conta a partir de agora", async () => {
    await vencerTeste();
    const res = await alterarAssinatura({ acao: "estender_teste", dias: 7 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ situacao: "teste", diasRestantes: 7, somenteLeitura: false });
    expect((await novoCliente()).status).toBe(201);

    const passado = await alterarAssinatura({ acao: "estender_teste", termina_em: "2020-01-01" });
    expect(passado.status).toBe(400);
  });

  it("suspender bloqueia a escrita com a mensagem de suspensa", async () => {
    const res = await alterarAssinatura({ acao: "suspender", motivo: "Cartão recusado" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ situacao: "suspensa", somenteLeitura: true });

    const bloqueado = await novoCliente();
    expect(bloqueado.status).toBe(402);
    expect(bloqueado.body).toMatchObject({ code: "ASSINATURA_NECESSARIA", situacao: "suspensa" });
  });

  it("listagem do painel filtra por situação", async () => {
    await vencerTeste();
    const vencidas = await request(app).get("/api/admin/oficinas?situacao=teste_vencido&pageSize=100&q=" + encodeURIComponent(suffix)).set("Cookie", cookieAdmin());
    expect(vencidas.status).toBe(200);
    const ids = vencidas.body.data.map((o: { id: number }) => o.id);
    expect(ids).toContain(oficinaId);
    expect(ids).not.toContain(antigaId);
    expect(vencidas.body.data.find((o: { id: number }) => o.id === oficinaId)).toMatchObject({
      origem: "cadastro",
      assinatura: { situacao: "teste_vencido" },
    });
  });

  it("ação inválida no painel responde 400 com a mensagem", async () => {
    const res = await alterarAssinatura({ acao: "ativar" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Escolha o plano: mensal ou semestral.");

    const futura = await alterarAssinatura({ acao: "ativar", plano: "mensal", ativada_em: "2999-01-01" });
    expect(futura.status).toBe(400);
    expect(futura.body.message).toBe("A data de ativação não pode ser no futuro.");
  });

  it("orçamento já respondido mostra a resposta, não o aviso de pausa", async () => {
    await prisma.orcamento.update({ where: { id: orcamentoId }, data: { status: "aprovado", respondido_pelo_cliente: true, respondido_em: new Date() } });
    await vencerTeste();
    const link = await request(app).get(`/api/public/acompanhamento/${codigoLink}`);
    expect(link.body).toMatchObject({ respostaPausada: false, resposta: { decisao: "aprovado" } });

    const aprovar = await request(app).post(`/api/public/acompanhamento/${codigoLink}/aprovar`).send({});
    expect(aprovar.body.code).toBe("ORCAMENTO_JA_RESPONDIDO");
  });
});
