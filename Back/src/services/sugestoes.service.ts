import type { Prisma, modulo_sugestao } from "@prisma/client";
import { prisma } from "../prisma/client.js";

// Rotulos exibidos no app e no painel; a ordem segue o menu lateral do app.
export const MODULOS_SUGESTAO: Record<modulo_sugestao, string> = {
  inicio: "Início",
  agenda: "Agenda",
  clientes: "Clientes",
  veiculos: "Veículos",
  orcamentos: "Orçamentos",
  ordens: "Ordens de serviço",
  financeiro: "Financeiro",
  estoque: "Estoque",
  relatorios: "Relatórios",
  configuracoes: "Configurações",
  outros: "Outros",
};

export const SugestoesService = {
  async criar({ oficinaId, usuarioId, modulo, mensagem }: {
    oficinaId: number;
    usuarioId: number;
    modulo: modulo_sugestao;
    mensagem: string;
  }) {
    return prisma.sugestao.create({
      data: { oficina_id: oficinaId, usuario_id: usuarioId, modulo, mensagem },
      select: { id: true, modulo: true, created_at: true },
    });
  },

  /** Todas as sugestoes (painel admin), com filtros e paginacao; padrao: mais recentes primeiro. */
  async listar(filtros: {
    modulo?: modulo_sugestao;
    oficinaId?: number;
    de?: Date;
    ate?: Date;
    q?: string;
    ordem: "asc" | "desc";
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.sugestaoWhereInput = {
      ...(filtros.modulo && { modulo: filtros.modulo }),
      ...(filtros.oficinaId && { oficina_id: filtros.oficinaId }),
      ...((filtros.de || filtros.ate) && {
        created_at: { ...(filtros.de && { gte: filtros.de }), ...(filtros.ate && { lt: filtros.ate }) },
      }),
      ...(filtros.q && {
        OR: [
          { mensagem: { contains: filtros.q, mode: "insensitive" } },
          { oficina: { nome: { contains: filtros.q, mode: "insensitive" } } },
          { usuario: { nome: { contains: filtros.q, mode: "insensitive" } } },
          { usuario: { email: { contains: filtros.q, mode: "insensitive" } } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      prisma.sugestao.count({ where }),
      prisma.sugestao.findMany({
        where,
        select: {
          id: true,
          modulo: true,
          mensagem: true,
          created_at: true,
          oficina: { select: { id: true, nome: true } },
          usuario: { select: { id: true, nome: true, email: true } },
        },
        // id desempata sugestoes criadas no mesmo instante, para a paginacao nao repetir nem pular itens
        orderBy: [{ created_at: filtros.ordem }, { id: filtros.ordem }],
        skip: (filtros.page - 1) * filtros.pageSize,
        take: filtros.pageSize,
      }),
    ]);

    return { data, total, page: filtros.page, pageSize: filtros.pageSize };
  },

  async listarPorOficina(oficinaId: number) {
    return prisma.sugestao.findMany({
      where: { oficina_id: oficinaId },
      select: {
        id: true,
        modulo: true,
        mensagem: true,
        created_at: true,
        usuario: { select: { id: true, nome: true, email: true } },
      },
      orderBy: { created_at: "desc" },
    });
  },
};
