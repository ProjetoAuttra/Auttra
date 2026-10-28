import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { prisma } from "../../prisma/client.js";
import { limparCacheSessao } from "../sessao.service.js";
import { PasswordResetService } from "../passwordReset.service.js";

export const AdminsService = {
  async listar() {
    return prisma.usuario.findMany({
      where: { tipo: "sistema", deleted_at: null },
      select: {
        id: true,
        nome: true,
        email: true,
        status: true,
        created_at: true,
        last_login_at: true,
        last_login_ip: true,
      } as any,
      orderBy: { created_at: "asc" },
    });
  },

  // O novo usuario recebe por e-mail um convite para criar a propria senha; quem cadastra nunca a conhece.
  async criar({ nome, email }: { nome: string; email: string }) {
    const existing = await prisma.usuario.findFirst({ where: { email: email.toLowerCase() } });
    if (existing) throw new Error("Já existe um usuário com este e-mail.");

    const senhaDescartavel = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    const usuario = await prisma.usuario.create({
      data: { nome, email: email.toLowerCase(), senha: senhaDescartavel, tipo: "sistema", status: "ativo" },
      select: { id: true, nome: true, email: true, status: true, created_at: true },
    });
    const convite = await PasswordResetService.createResetForUser(usuario.id, { convite: true });
    return { usuario, convite };
  },

  async atualizar(id: number, { nome, email }: { nome: string; email: string }) {
    const usuario = await prisma.usuario.findFirst({ where: { id, tipo: "sistema", deleted_at: null } });
    if (!usuario) throw new Error("Usuário não encontrado.");

    const normalizado = email.trim().toLowerCase();
    const emUso = await prisma.usuario.findFirst({ where: { email: normalizado, id: { not: id } } });
    if (emUso) throw new Error("Já existe um usuário com este e-mail.");

    return prisma.usuario.update({
      where: { id },
      data: { nome: nome.trim(), email: normalizado },
      select: { id: true, nome: true, email: true, status: true },
    });
  },

  async linkSenha(id: number) {
    const usuario = await prisma.usuario.findFirst({ where: { id, tipo: "sistema", deleted_at: null, status: "ativo" } });
    if (!usuario) throw new Error("Usuário não encontrado ou inativo.");
    return PasswordResetService.createResetForUser(id);
  },

  async desativar(id: number, actorId?: number) {
    if (actorId && id === actorId) throw new Error("Não é possível desativar sua própria conta.");

    const admin = await prisma.usuario.findFirst({ where: { id, tipo: "sistema", deleted_at: null } });
    if (!admin) throw new Error("Administrador não encontrado.");

    const total = await prisma.usuario.count({ where: { tipo: "sistema", status: "ativo", deleted_at: null } });
    if (total <= 1) throw new Error("Não é possível desativar o único administrador ativo.");

    const desativado = await prisma.usuario.update({ where: { id }, data: { status: "inativo" } });
    limparCacheSessao(id);
    return desativado;
  },

  async reativar(id: number) {
    const admin = await prisma.usuario.findFirst({ where: { id, tipo: "sistema", deleted_at: null } });
    if (!admin) throw new Error("Administrador não encontrado.");
    return prisma.usuario.update({ where: { id }, data: { status: "ativo" } });
  },
};
