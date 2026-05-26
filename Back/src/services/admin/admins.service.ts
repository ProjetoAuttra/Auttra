import bcrypt from "bcrypt";
import { prisma } from "../../prisma/client.js";

const MAX_ACTIVE_ADMINS = 2;

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

  async criar({ nome, email, senha }: { nome: string; email: string; senha: string }) {
    const activeAdmins = await prisma.usuario.count({ where: { tipo: "sistema", status: "ativo", deleted_at: null } });
    if (activeAdmins >= MAX_ACTIVE_ADMINS) throw new Error("Limite de 2 administradores ativos atingido.");

    const existing = await prisma.usuario.findFirst({ where: { email: email.toLowerCase() } });
    if (existing) throw new Error("Já existe um usuário com este e-mail.");
    const senhaOk = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(senha);
    if (!senhaOk) throw new Error("A senha deve ter no mínimo 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial.");

    const senhaHash = await bcrypt.hash(senha, 10);
    return prisma.usuario.create({
      data: { nome, email: email.toLowerCase(), senha: senhaHash, tipo: "sistema", status: "ativo" },
      select: { id: true, nome: true, email: true, status: true, created_at: true },
    });
  },

  async desativar(id: number, actorId?: number) {
    if (actorId && id === actorId) throw new Error("Não é possível desativar sua própria conta.");

    const admin = await prisma.usuario.findFirst({ where: { id, tipo: "sistema", deleted_at: null } });
    if (!admin) throw new Error("Administrador não encontrado.");

    const total = await prisma.usuario.count({ where: { tipo: "sistema", status: "ativo", deleted_at: null } });
    if (total <= 1) throw new Error("Não é possível desativar o único administrador ativo.");

    return prisma.usuario.update({ where: { id }, data: { status: "inativo" } });
  },

  async reativar(id: number) {
    const activeAdmins = await prisma.usuario.count({ where: { tipo: "sistema", status: "ativo", deleted_at: null } });
    if (activeAdmins >= MAX_ACTIVE_ADMINS) throw new Error("Limite de 2 administradores ativos atingido.");

    const admin = await prisma.usuario.findFirst({ where: { id, tipo: "sistema", deleted_at: null } });
    if (!admin) throw new Error("Administrador não encontrado.");
    return prisma.usuario.update({ where: { id }, data: { status: "ativo" } });
  },
};
