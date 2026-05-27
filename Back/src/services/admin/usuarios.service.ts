import { prisma } from "../../prisma/client.js";
import { PasswordResetService } from "../passwordReset.service.js";

export const UsuariosAdminService = {
  async listar(oficina_id?: number) {
    const where = oficina_id
      ? { deleted_at: null, tipo: { not: "sistema" as const }, acessos: { some: { oficina_id, deleted_at: null } } }
      : { deleted_at: null, tipo: { not: "sistema" as const } };

    return prisma.usuario.findMany({
      where,
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        status: true,
        created_at: true,
        last_login_at: true,
        acessos: {
          where: { deleted_at: null },
          select: { oficina_id: true, perfil: true, oficina: { select: { id: true, nome: true } } },
        },
      } as any,
      orderBy: { created_at: "desc" },
    });
  },

  async updateEmail(id: number, novoEmail: string) {
    const email = novoEmail.trim().toLowerCase();

    const existente = await prisma.usuario.findFirst({ where: { email, deleted_at: null } });
    if (existente && existente.id !== id) throw new Error("E-mail já está em uso por outro usuário.");

    const usuario = await prisma.usuario.findFirst({ where: { id, deleted_at: null, tipo: { not: "sistema" } } });
    if (!usuario) throw new Error("Usuário não encontrado.");

    return prisma.usuario.update({ where: { id }, data: { email } });
  },

  async resetSenha(id: number) {
    const usuario = await prisma.usuario.findFirst({
      where: { id, deleted_at: null, tipo: { not: "sistema" } },
      select: { id: true },
    });
    if (!usuario) throw new Error("Usuário não encontrado.");

    return PasswordResetService.createResetForUser(id);
  },
};
