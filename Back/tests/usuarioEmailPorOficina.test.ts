import bcrypt from "bcrypt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/prisma/client.js";
import { UsuarioService } from "../src/services/usuario.service.js";

const suffix = Date.now();

// Auditoria V1, B5: e-mail e unico por oficina, mas a mesma conta pode estar em oficinas diferentes.
describe.skipIf(!process.env.DATABASE_URL)("usuários: e-mail por oficina", () => {
  let cidadeId: number;
  let oficinaA: number;
  let oficinaB: number;
  const emails: string[] = [];

  const novoEmail = (tag: string) => {
    const e = `usr.${tag}.${suffix}@teste.com`;
    emails.push(e);
    return e;
  };
  const criar = (oficina_id: number, email: string, extra: Record<string, unknown> = {}) =>
    UsuarioService.create({ nome: "Usuario Teste", senha: "SenhaForte1", tipo: "funcionario", oficina_id, email, ...extra });

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Usr ${suffix}`, uf: "SP" } })).id;
    const mk = async (n: string) => {
      const oficina = await prisma.oficina.create({
        data: { nome: `Oficina Usr ${n} ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId },
      });
      await prisma.perfil_acesso.create({ data: { oficina_id: oficina.id, nome: "Recepcao", permissoes: {} } });
      return oficina.id;
    };
    oficinaA = await mk("A");
    oficinaB = await mk("B");
  });

  afterAll(async () => {
    const ids = (await prisma.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } })).map((u) => u.id);
    await prisma.usuario_oficina.deleteMany({ where: { oficina_id: { in: [oficinaA, oficinaB] } } });
    await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
    await prisma.perfil_acesso.deleteMany({ where: { oficina_id: { in: [oficinaA, oficinaB] } } });
    await prisma.oficina.deleteMany({ where: { id: { in: [oficinaA, oficinaB] } } });
    await prisma.cidade.delete({ where: { id: cidadeId } });
  });

  it("recusa o mesmo e-mail duas vezes na mesma oficina", async () => {
    const email = novoEmail("dup");
    await criar(oficinaA, email);
    await expect(criar(oficinaA, email, { senha: "OutraSenha1" })).rejects.toMatchObject({ status: 409 });
  });

  it("vincula conta de outra oficina sem trocar senha nem nome e sem expor as outras oficinas", async () => {
    const email = novoEmail("multi");
    await criar(oficinaA, email, { nome: "Nome Original" });
    const r = await criar(oficinaB, email, { nome: "Nome Novo", senha: "SenhaDeB123" });

    expect(r.conta_existente).toBe(true);
    expect(r.oficinas.map((o) => o.id)).toEqual([oficinaB]);

    const u = await prisma.usuario.findUniqueOrThrow({ where: { email } });
    expect(u.nome).toBe("Nome Original");
    expect(await bcrypt.compare("SenhaForte1", u.senha)).toBe(true);
    expect(await prisma.usuario_oficina.count({ where: { usuario_id: u.id, deleted_at: null } })).toBe(2);
  });

  it("recusa vincular admin do sistema", async () => {
    const email = novoEmail("sistema");
    await prisma.usuario.create({ data: { nome: "Admin", email, senha: "x", tipo: "sistema" } });
    await expect(criar(oficinaA, email)).rejects.toMatchObject({ status: 409 });
    expect(await prisma.usuario_oficina.count({ where: { usuario: { email } } })).toBe(0);
  });

  it("não exclui admin do sistema mesmo que tenha vínculo com a oficina", async () => {
    const email = novoEmail("sistemavinculado");
    const admin = await prisma.usuario.create({ data: { nome: "Admin", email, senha: "x", tipo: "sistema" } });
    await prisma.usuario_oficina.create({ data: { usuario_id: admin.id, oficina_id: oficinaA, perfil: "gestoroficina" } });

    await expect(UsuarioService.delete(admin.id, oficinaA)).rejects.toThrow(/nao encontrado/);
    const depois = await prisma.usuario.findUniqueOrThrow({ where: { id: admin.id } });
    expect(depois.deleted_at).toBeNull();
    expect(depois.status).toBe("ativo");
  });

  it("e-mail de conta excluída volta a valer e a conta é reativada", async () => {
    const email = novoEmail("excluido");
    const criado = await criar(oficinaA, email);
    await UsuarioService.delete(criado.id, oficinaA);

    const r = await criar(oficinaB, email);
    expect(r.conta_existente).toBe(true);
    const u = await prisma.usuario.findUniqueOrThrow({ where: { email } });
    expect(u.deleted_at).toBeNull();
    expect(u.status).toBe("ativo");
  });
});
