import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";
import { cadastroSchema } from "../src/schemas/cadastro.schema.js";
import { ConfirmacaoEmailService } from "../src/services/cadastro.service.js";

describe("cadastroSchema", () => {
  const base = { nome: "Ana Souza", oficina: "Auto Center", whatsapp: "(11) 98888-7777", email: " Ana@Example.COM ", senha: "segredo1", aceite_termos: true };

  it("normaliza e-mail e WhatsApp; guarda só os UTMs conhecidos", () => {
    const r = cadastroSchema.parse({ ...base, campanha: { utm_source: " google ", utm_medium: "cpc", gclid: "x", utm_term: 5 } });
    expect(r).toMatchObject({ email: "ana@example.com", whatsapp: "11988887777", campanha: { utm_source: "google", utm_medium: "cpc" } });
    expect(r.campanha).not.toHaveProperty("gclid");
    expect(cadastroSchema.parse(base).campanha).toBeNull();
    expect(cadastroSchema.parse({ ...base, campanha: "lixo" }).campanha).toBeNull();
  });

  it("recusa com a mensagem do campo", () => {
    const msg = (extra: object) => cadastroSchema.safeParse({ ...base, ...extra }).error?.issues[0]?.message;
    expect(msg({ whatsapp: "9999" })).toBe("WhatsApp deve ter 10 ou 11 dígitos, com DDD.");
    expect(msg({ senha: "123" })).toBe("A senha deve ter pelo menos 6 caracteres.");
    expect(msg({ email: "ana@" })).toBe("E-mail inválido.");
    expect(msg({ aceite_termos: false })).toMatch(/aceite os Termos/);
    expect(msg({ nome: " " })).toBe("Informe seu nome.");
  });
});

describe.skipIf(!process.env.DATABASE_URL)("cadastro pelo site", () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const emails: string[] = [];
  const emailsEnviados: { to: unknown; subject: string; html: string }[] = [];
  let ipSeq = 0;
  const novoIp = () => `10.77.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;
  const resendAnterior = process.env.RESEND_API_KEY;

  const dados = (extra: Record<string, unknown> = {}) => {
    const email = `cadastro-${suffix}-${emails.length}@example.com`;
    emails.push(email);
    return {
      nome: "Maria Teste",
      oficina: `Oficina Cadastro ${suffix}`,
      whatsapp: "11988887777",
      email,
      senha: "segredo1",
      aceite_termos: true,
      turnstileToken: "ok",
      ...extra,
    };
  };
  const cadastrar = (body: Record<string, unknown>, ip = novoIp()) =>
    request(app).post("/api/auth/cadastro").set("X-Forwarded-For", ip).send(body);

  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_teste";
    // Turnstile e Resend falsos: token "falha" é recusado; e-mails ficam guardados para conferir.
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (String(url).includes("turnstile")) {
        const token = new URLSearchParams(String(init?.body)).get("response");
        return new Response(JSON.stringify({ success: token !== "falha" }));
      }
      if (String(url).includes("resend")) {
        emailsEnviados.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ id: "x" }));
      }
      throw new Error(`fetch inesperado: ${url}`);
    });
  });

  afterAll(async () => {
    if (resendAnterior === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = resendAnterior;
    const usuarios = await prisma.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } });
    const ids = usuarios.map((u) => u.id);
    const oficinas = await prisma.oficina.findMany({
      where: { OR: [{ gestor_usuario_id: { in: ids } }, { nome: { contains: suffix } }] },
      select: { id: true },
    });
    const oficinaIds = oficinas.map((o) => o.id);
    await prisma.admin_audit_log.deleteMany({ where: { oficina_id: { in: oficinaIds } } });
    await prisma.usuario_oficina.deleteMany({ where: { OR: [{ usuario_id: { in: ids } }, { oficina_id: { in: oficinaIds } }] } });
    await prisma.oficina.updateMany({ where: { id: { in: oficinaIds } }, data: { gestor_usuario_id: null } });
    await prisma.perfil_acesso.deleteMany({ where: { oficina_id: { in: oficinaIds } } });
    await prisma.oficina.deleteMany({ where: { id: { in: oficinaIds } } });
    await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
    await prisma.cidade.deleteMany({ where: { nome: { contains: suffix } } });
  });

  it("cria oficina em teste de 7 dias, proprietário e perfis, e já devolve a sessão", async () => {
    const antes = Date.now();
    const body = dados({ campanha: { utm_source: "google", utm_campaign: "lancamento", outro: "x" } });
    const res = await cadastrar(body);
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.usuario).toMatchObject({ email: body.email, nome: "Maria Teste", tipo: "gestoroficina", oficina_nome: body.oficina });
    expect(res.body.usuario.permissoes.configuracoes).toContain("update");

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email: body.email } });
    expect(usuario).toMatchObject({ tipo: "gestoroficina", status: "ativo", telefone: "11988887777", email_confirmado_em: null });
    expect(usuario.senha).not.toBe("segredo1");

    const oficina = await prisma.oficina.findUniqueOrThrow({ where: { id: res.body.usuario.oficinaId }, include: { perfis_acesso: true } });
    expect(oficina).toMatchObject({
      nome: body.oficina, whatsapp: "11988887777", assinatura_status: "teste", origem: "cadastro",
      gestor_usuario_id: usuario.id, logradouro: null, cep: null, cidade_id: null, email: null,
      origem_campanha: { utm_source: "google", utm_campaign: "lancamento" },
    });
    const dias = (oficina.teste_termina_em!.getTime() - antes) / 86_400_000;
    expect(dias).toBeGreaterThan(6.99);
    expect(dias).toBeLessThan(7.01);
    expect(oficina.perfis_acesso.map((p) => p.chave).sort()).toEqual(["mecanico", "proprietario", "recepcao"]);

    const historico = await prisma.admin_audit_log.findFirst({ where: { oficina_id: oficina.id, action: "oficina.cadastro_site" } });
    expect(historico?.message).toContain(body.email);

    // A sessão devolvida funciona: vê a assinatura e consegue gravar.
    const auth = `Bearer ${res.body.token}`;
    const assinatura = await request(app).get("/api/assinatura").set("Authorization", auth);
    expect(assinatura.body).toMatchObject({ situacao: "teste", diasRestantes: 7, somenteLeitura: false });
    const empresa = await request(app).patch("/api/oficinas/minha").set("Authorization", auth).send({ telefone: "1133334444" });
    expect(empresa.status).toBe(200);

    // E-mail de boas-vindas com o link de confirmação.
    await vi.waitFor(() => expect(emailsEnviados.some((e) => e.to === body.email)).toBe(true));
    const boasVindas = emailsEnviados.find((e) => e.to === body.email)!;
    expect(boasVindas.html).toContain("/confirmar-email?token=");
  });

  it("a senha escolhida no cadastro serve no login", async () => {
    const body = dados();
    expect((await cadastrar(body)).status).toBe(201);
    const verificacao = await request(app).post("/api/auth/verify-email").send({ email: body.email, turnstileToken: "ok" });
    const login = await request(app).post("/api/auth/login").send({ email: body.email, senha: "segredo1", emailToken: verificacao.body.emailToken });
    expect(login.status).toBe(200);
    expect(login.body.token).toEqual(expect.any(String));
  });

  it("e-mail que já tem conta (qualquer caixa) é recusado sem criar nada", async () => {
    const body = dados();
    expect((await cadastrar(body)).status).toBe(201);
    const oficinasAntes = await prisma.oficina.count({ where: { nome: { contains: suffix } } });

    const repetido = await cadastrar({ ...body, email: body.email.toUpperCase(), oficina: `Outra ${suffix}` });
    expect(repetido.status).toBe(409);
    expect(repetido.body).toMatchObject({ code: "EMAIL_JA_CADASTRADO", message: "Esse e-mail já tem conta. Entre ou recupere a senha." });
    expect(await prisma.oficina.count({ where: { nome: { contains: suffix } } })).toBe(oficinasAntes);
  });

  it("nome de oficina repetido não impede o cadastro", async () => {
    const nome = `Auto Center Homônimo ${suffix}`;
    expect((await cadastrar(dados({ oficina: nome }))).status).toBe(201);
    expect((await cadastrar(dados({ oficina: nome }))).status).toBe(201);
    expect(await prisma.oficina.count({ where: { nome } })).toBe(2);
  });

  it("Turnstile recusado ou ausente barra o cadastro", async () => {
    const recusado = dados({ turnstileToken: "falha" });
    const res = await cadastrar(recusado);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("CAPTCHA_FAILED");
    const semToken = dados({ turnstileToken: undefined });
    expect((await cadastrar(semToken)).status).toBe(400);
    expect(await prisma.usuario.count({ where: { email: { in: [recusado.email, semToken.email] } } })).toBe(0);
  });

  it("campo-isca preenchido e dados inválidos são recusados antes do Turnstile", async () => {
    const isca = await cadastrar(dados({ site: "http://spam" }));
    expect(isca.status).toBe(400);
    expect(isca.body.code).toBe("CADASTRO_RECUSADO");

    const invalido = await cadastrar(dados({ whatsapp: "123" }));
    expect(invalido.status).toBe(400);
    expect(invalido.body.message).toBe("WhatsApp deve ter 10 ou 11 dígitos, com DDD.");

    const semAceite = await cadastrar(dados({ aceite_termos: false }));
    expect(semAceite.status).toBe(400);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("turnstile"))).toBe(false);
  });

  it("limita a 5 contas por hora por IP; tentativa recusada não conta", async () => {
    const ip = novoIp();
    expect((await cadastrar(dados({ whatsapp: "1" }), ip)).status).toBe(400);
    for (let i = 0; i < 5; i++) expect((await cadastrar(dados(), ip)).status).toBe(201);
    const sexto = await cadastrar(dados(), ip);
    expect(sexto.status).toBe(429);
    expect(sexto.body.code).toBe("LIMITE_CADASTRO");
    // Outro IP segue livre.
    expect((await cadastrar(dados())).status).toBe(201);
  });

  it("confirma o e-mail pelo link; repetir não é erro; link adulterado ou de outro e-mail é recusado", async () => {
    const body = dados();
    const res = await cadastrar(body);
    const usuario = { id: res.body.usuario.id as number, email: body.email };

    const ok = await request(app).post("/api/auth/confirmar-email").send({ token: ConfirmacaoEmailService.gerarToken(usuario) });
    expect(ok.status).toBe(200);
    const confirmado = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(confirmado.email_confirmado_em).toBeInstanceOf(Date);

    const denovo = await request(app).post("/api/auth/confirmar-email").send({ token: ConfirmacaoEmailService.gerarToken(usuario) });
    expect(denovo.status).toBe(200);
    expect(new Date(denovo.body.confirmadoEm).getTime()).toBe(confirmado.email_confirmado_em!.getTime());

    const outroEmail = ConfirmacaoEmailService.gerarToken({ id: usuario.id, email: "antigo@example.com" });
    const tokenDeLogin = jwt.sign({ purpose: "email-verified", sub: String(usuario.id), email: body.email }, getJwtSecret());
    for (const token of [outroEmail, tokenDeLogin, "lixo", undefined]) {
      const r = await request(app).post("/api/auth/confirmar-email").send({ token });
      expect(r.status).toBe(400);
      expect(r.body.code).toBe("CONFIRMACAO_INVALIDA");
    }
  });

  it("reenvia o link para quem está logado e ainda não confirmou", async () => {
    const body = dados();
    const res = await cadastrar(body);
    const auth = `Bearer ${res.body.token}`;
    emailsEnviados.length = 0;

    const reenvio = await request(app).post("/api/auth/reenviar-confirmacao").set("Authorization", auth);
    expect(reenvio.status).toBe(200);
    expect(reenvio.body).toMatchObject({ enviado: true, jaConfirmado: false });
    expect(emailsEnviados.find((e) => e.to === body.email)?.subject).toBe("Confirme seu e-mail no Auttra");

    await prisma.usuario.update({ where: { id: res.body.usuario.id }, data: { email_confirmado_em: new Date() } });
    const jaConfirmado = await request(app).post("/api/auth/reenviar-confirmacao").set("Authorization", auth);
    expect(jaConfirmado.body).toMatchObject({ enviado: false, jaConfirmado: true });

    expect((await request(app).post("/api/auth/reenviar-confirmacao")).status).toBe(401);
  });

  it("tela de empresa aceita endereço vazio; cidade sem UF é recusada; a rota antiga de criar oficina saiu", async () => {
    const res = await cadastrar(dados());
    const auth = `Bearer ${res.body.token}`;
    const salvar = (extra: object) =>
      request(app).patch("/api/oficinas/minha").set("Authorization", auth).send({
        nome: "Oficina Sem Endereço " + suffix, cep: "", logradouro: "", numero: "", complemento: "", cidade_nome: "", cidade_uf: "", ...extra,
      });

    const vazio = await salvar({});
    expect(vazio.status).toBe(200);
    expect(vazio.body).toMatchObject({ logradouro: null, numero: null, cep: null, cidade_id: null });

    const completo = await salvar({ cep: "01001-000", logradouro: "Praça da Sé", numero: "1", cidade_nome: `Cidade ${suffix}`, cidade_uf: "sp" });
    expect(completo.status).toBe(200);
    expect(completo.body).toMatchObject({ cep: "01001000", logradouro: "Praça da Sé", cidade: { nome: `Cidade ${suffix}`, uf: "SP" } });

    const semUf = await salvar({ cidade_nome: "São Paulo" });
    expect(semUf.status).toBe(400);
    expect(semUf.body.message).toBe("Informe a UF junto com a cidade.");
    expect((await salvar({ cep: "123" })).status).toBe(400);

    expect((await request(app).post("/api/oficinas").set("Authorization", auth).send({ nome: "x" })).status).toBe(404);
  });
});
