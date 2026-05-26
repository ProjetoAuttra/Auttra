import { prisma } from "../../prisma/client.js";

export const MetricasAdminService = {
  async get() {
    const [total_oficinas, total_oficinas_ativas, total_usuarios] = await Promise.all([
      prisma.oficina.count(),
      prisma.oficina.count({ where: { deleted_at: null } }),
      prisma.usuario.count({ where: { deleted_at: null, tipo: { not: "sistema" } } }),
    ]);

    return { total_oficinas, total_oficinas_ativas, total_usuarios };
  },
};
