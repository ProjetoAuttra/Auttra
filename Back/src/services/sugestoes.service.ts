import type { modulo_sugestao } from "@prisma/client";
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
