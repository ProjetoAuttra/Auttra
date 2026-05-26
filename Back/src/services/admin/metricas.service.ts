import { prisma } from "../../prisma/client.js";

export const MetricasAdminService = {
  async get() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [total_oficinas_ativas, total_usuarios, total_os_abertas, oficinas_no_mes] = await Promise.all([
      prisma.oficina.count({ where: { deleted_at: null } }),
      prisma.usuario.count({ where: { deleted_at: null, tipo: { not: "sistema" } } }),
      prisma.ordem_servico.count({
        where: { deleted_at: null, status: { in: ["aberta", "em_andamento"] } },
      }),
      prisma.oficina.count({
        where: { deleted_at: null, created_at: { gte: startOfMonth } },
      }),
    ]);

    return { total_oficinas_ativas, total_usuarios, total_os_abertas, oficinas_no_mes };
  },
};
