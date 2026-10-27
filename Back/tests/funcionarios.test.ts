import bcrypt from "bcrypt";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/prisma/client.js";
import { FuncionariosService } from "../src/services/funcionarios.service.js";

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
    const tokens = await prisma.password_reset_token.count({ where: { usuario_id: u.id, used_at: null } });
    expect(tokens).toBe(1);
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

  it("recusa vincular e-mail de conta que não é de funcionário", async () => {
    const email = novoEmail("admin");
    await prisma.usuario.create({ data: { nome: "Sistema", email, senha: "x", tipo: "sistema" } });
    await expect(criar(oficinaA, perfilA, { email })).rejects.toThrow(/não pode ser vinculada/);
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
