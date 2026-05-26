import { prisma } from "../../prisma/client.js";

export const MetricasAdminService = {
  async get() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      total_oficinas_ativas,
      total_oficinas_inativas,
      total_usuarios,
      total_os_abertas,
      oficinas_no_mes,
      oficinas_30_dias,
      oficinas_com_os_aberta,
      usuarios_ativos_por_oficina,
      alertas,
    ] = await Promise.all([
      prisma.oficina.count({ where: { deleted_at: null } }),
      prisma.oficina.count({ where: { deleted_at: { not: null } } }),
      prisma.usuario.count({ where: { deleted_at: null, tipo: { not: "sistema" } } }),
      prisma.ordem_servico.count({
        where: { deleted_at: null, status: { in: ["aberta", "em_andamento"] } },
      }),
      prisma.oficina.count({
        where: { deleted_at: null, created_at: { gte: startOfMonth } },
      }),
      prisma.oficina.count({
        where: { deleted_at: null, created_at: { gte: last30Days } },
      }),
      prisma.oficina.count({
        where: {
          deleted_at: null,
          ordens_servico: { some: { deleted_at: null, status: { in: ["aberta", "em_andamento"] } } },
        },
      }),
      prisma.oficina.findMany({
        where: { deleted_at: null },
        select: {
          id: true,
          nome: true,
          _count: { select: { acessos: { where: { deleted_at: null, status: "ativo" } } } },
        },
        orderBy: { nome: "asc" },
        take: 10,
      }),
      prisma.oficina.findMany({
        where: {
          deleted_at: null,
          OR: [
            { gestor_usuario_id: null },
            { telefone: null },
            { email: null },
            { cnpj: null },
          ],
        },
        select: {
          id: true,
          nome: true,
          gestor_usuario_id: true,
          telefone: true,
          email: true,
          cnpj: true,
        },
        orderBy: { created_at: "desc" },
        take: 8,
      }),
    ]);

    return {
      total_oficinas_ativas,
      total_oficinas_inativas,
      total_usuarios,
      total_os_abertas,
      oficinas_no_mes,
      oficinas_30_dias,
      oficinas_com_os_aberta,
      usuarios_ativos_por_oficina: usuarios_ativos_por_oficina.map((oficina) => ({
        id: oficina.id,
        nome: oficina.nome,
        total_usuarios_ativos: oficina._count.acessos,
      })),
      alertas_cadastro: alertas.map((oficina) => ({
        id: oficina.id,
        nome: oficina.nome,
        pendencias: [
          !oficina.gestor_usuario_id ? "sem gestor" : null,
          !oficina.telefone ? "sem telefone" : null,
          !oficina.email ? "sem e-mail" : null,
          !oficina.cnpj ? "sem CNPJ" : null,
        ].filter(Boolean),
      })),
    };
  },
};
