import bcrypt from "bcrypt";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/prisma/client.js";
import { FuncionariosService } from "../src/services/funcionarios.service.js";
import { sendEmail } from "../src/services/email.service.js";

vi.mock("../src/services/email.service.js", () => ({
  EmailDeliveryError: class extends Error {},
  sendEmail: vi.fn(async () => ({})),
}));

const suffix = Date.now();

describe.skipIf(!process.env.DATABASE_URL)("funcionários (convite e contas compartilhadas)", () => {
  let cidadeId: number;
  let oficinaA: number;
  let oficinaB: number;
  let perfilA: number;
  let perfilB: number;
  const emails: string[] = [];

  const novoEmail = (tag: string) => {
    const e = `${tag}.${suffix}@teste.com`;
    emails.push(e);
    return e;
  };
  const criar = (oficina_id: number, perfil_acesso_id: number, extra: Record<string, unknown>) =>
    FuncionariosService.create({
      nome: "Func Teste",
      telefone: "11999999999",
      cargo: "mecanico",
      oficina_id,
      perfil_acesso_id,
      ...extra,
    });

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Func ${suffix}`, uf: "SP" } })).id;
    const mk = async (n: string) =>
      (
        await prisma.oficina.create({
          data: { nome: `Oficina ${n} ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId },
        })
      ).id;
    oficinaA = await mk("A");
    oficinaB = await mk("B");
    const mkPerfil = async (oficina_id: number) =>
      (await prisma.perfil_acesso.create({ data: { oficina_id, nome: `Perfil ${suffix}`, permissoes: {} } })).id;
    perfilA = await mkPerfil(oficinaA);
    perfilB = await mkPerfil(oficinaB);
  });

  afterAll(async () => {
    const usuarios = await prisma.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } });
    const ids = usuarios.map((u) => u.id);
    await prisma.password_reset_token.deleteMany({ where: { usuario_id: { in: ids } } });
    await prisma.funcionario.deleteMany({ where: { oficina_id: { in: [oficinaA, oficinaB] } } });
    await prisma.usuario_oficina.deleteMany({ where: { oficina_id: { in: [oficinaA, oficinaB] } } });
    await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
    await prisma.perfil_acesso.deleteMany({ where: { id: { in: [perfilA, perfilB] } } });
    await prisma.oficina.deleteMany({ where: { id: { in: [oficinaA, oficinaB] } } });
    await prisma.cidade.delete({ where: { id: cidadeId } });
  });

  it("sem senha, cria conta com senha inutilizável e envia convite", async () => {
    const email = novoEmail("convite");
    const f: any = await criar(oficinaA, perfilA, { email });
    expect(f.convite_enviado).toBe(true);

    const u = await prisma.usuario.findUniqueOrThrow({ where: { email } });
    expect(await bcrypt.compare("123456", u.senha)).toBe(false);
    const tokens = await prisma.password_reset_token.findMany({ where: { usuario_id: u.id, used_at: null } });
    expect(tokens).toHaveLength(1);

    // Convite de verdade (link de 7 dias e assunto de convite), não o reset de senha de 60 minutos.
    const dias = (tokens[0].expires_at.getTime() - Date.now()) / 86_400_000;
    expect(dias).toBeGreaterThan(6.9);
    expect(sendEmail).toHaveBeenLastCalledWith(expect.objectContaining({ to: email, subject: "Seu acesso ao Auttra" }));
    expect(f.convite_link).toMatch(/token=/);
  });

  it("e-mail que não sai: avisa e devolve o link para o gestor repassar", async () => {
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("smtp fora"));
    const f: any = await criar(oficinaA, perfilA, { email: novoEmail("semenvio") });
    expect(f.convite_enviado).toBe(false);
    expect(f.convite_link).toMatch(/token=/);
  });

  it("com senha informada, usa a senha e não envia convite", async () => {
    const email = novoEmail("comsenha");
    const f: any = await criar(oficinaA, perfilA, { email, senha: "SenhaForte1" });
    expect(f.convite_enviado).toBeUndefined();
    const u = await prisma.usuario.findUniqueOrThrow({ where: { email } });
    expect(await bcrypt.compare("SenhaForte1", u.senha)).toBe(true);
  });

  it("rejeita senha curta", async () => {
    await expect(criar(oficinaA, perfilA, { email: novoEmail("curta"), senha: "123" })).rejects.toThrow(/6 caracteres/);
  });

  it("vincular e-mail já existente em outra oficina não sobrescreve nome nem senha", async () => {
    const email = novoEmail("compartilhado");
    await criar(oficinaA, perfilA, { email, nome: "Nome Original", senha: "SenhaOriginal1" });
    await criar(oficinaB, perfilB, { email, nome: "Nome Invasor", senha: "SenhaInvasor1" });

    const u = await prisma.usuario.findUniqueOrThrow({ where: { email } });
    expect(u.nome).toBe("Nome Original");
    expect(await bcrypt.compare("SenhaOriginal1", u.senha)).toBe(true);
    expect(await prisma.usuario_oficina.count({ where: { usuario_id: u.id } })).toBe(2);
  });

  it("recusa vincular e-mail de admin do sistema", async () => {
    const email = novoEmail("admin");
    await prisma.usuario.create({ data: { nome: "Sistema", email, senha: "x", tipo: "sistema" } });
    await expect(criar(oficinaA, perfilA, { email })).rejects.toThrow(/nao pode ser usado/);
    const u = await prisma.usuario.findUniqueOrThrow({ where: { email }, include: { acessos: true } });
    expect(u.acessos).toHaveLength(0);
  });

  it("recusa o mesmo e-mail duas vezes na mesma oficina", async () => {
    const email = novoEmail("duplicado");
    await criar(oficinaA, perfilA, { email, senha: "SenhaOriginal1" });
    await expect(criar(oficinaA, perfilA, { email, senha: "OutraSenha1" })).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/nesta oficina/),
    });
  });

  it("gestor de uma oficina pode ser funcionário em outra", async () => {
    const email = novoEmail("gestor");
    await prisma.usuario.create({ data: { nome: "Gestor", email, senha: "x", tipo: "gestoroficina" } });
    const f: any = await criar(oficinaB, perfilB, { email });
    expect(f.conta_existente).toBe(true);
    expect(f.convite_enviado).toBeUndefined();
  });

  it("oficina não altera senha de conta compartilhada ao editar funcionário", async () => {
    const email = novoEmail("edicao");
    await criar(oficinaA, perfilA, { email, senha: "SenhaOriginal1" });
    const fB: any = await criar(oficinaB, perfilB, { email });
    await FuncionariosService.update(fB.id, { senha: "SenhaInvasor1", nome: "Invasor" }, oficinaB);

    const u = await prisma.usuario.findUniqueOrThrow({ where: { email } });
    expect(await bcrypt.compare("SenhaOriginal1", u.senha)).toBe(true);
    expect(u.nome).not.toBe("Invasor");
  });
});
