import { prisma } from "../prisma/client.js";
import { LIMITE_LISTAGEM } from "../utils/limites.js";
import { listarPaginado, type Paginacao } from "../utils/paginacao.js";

const valorNaoNegativo = (valor: unknown, campo: string) => {
  const n = Number(valor);
  if (valor === null || valor === "" || !Number.isFinite(n) || n < 0) throw new Error(`Campo ${campo} inválido.`);
  return n;
};

/**
 * Campos que a edicao da peca pode alterar, montados um a um. Repassar o body deixava passar
 * relacoes como oficina/compras/itens com connect, que moviam registros entre oficinas.
 * O estoque continua editavel porque o formulario de estoque o envia (historico: auditoria I15).
 */
function camposEditaveisPeca(data: any) {
  const patch: { nome?: string; descricao?: string | null; preco_custo?: number; preco_venda?: number; estoque?: number } = {};
  if (!data || typeof data !== "object") return patch;

  if (data.nome !== undefined) {
    const nome = String(data.nome ?? "").trim();
    if (!nome) throw new Error("O nome da peça é obrigatório.");
    patch.nome = nome;
  }
  if (data.descricao !== undefined) {
    patch.descricao = data.descricao === null || data.descricao === "" ? null : String(data.descricao);
  }
  if (data.preco_custo !== undefined) patch.preco_custo = valorNaoNegativo(data.preco_custo, "preco_custo");
  if (data.preco_venda !== undefined) patch.preco_venda = valorNaoNegativo(data.preco_venda, "preco_venda");
  if (data.estoque !== undefined) {
    const estoque = valorNaoNegativo(data.estoque, "estoque");
    if (!Number.isInteger(estoque)) throw new Error("Campo estoque inválido.");
    patch.estoque = estoque;
  }
  return patch;
}

export const PecasService = {
  list: async (
    oficinaId: number,
    search: string = "",
    pag: Paginacao | null = null,
    opts: { estoqueMaximo?: number; ordenarPor?: "nome" | "estoque"; direcao?: "asc" | "desc" } = {}
  ) => {
    const where: any = { deleted_at: null, oficina_id: oficinaId };
    if (search.trim().length > 0) {
      const contains = { contains: search.trim(), mode: "insensitive" };
      where.OR = [{ nome: contains }, { descricao: contains }];
    }
    if (opts.estoqueMaximo !== undefined) where.estoque = { lte: opts.estoqueMaximo };
    const orderBy = opts.ordenarPor ? { [opts.ordenarPor]: opts.direcao ?? "asc" } : { id: "desc" as const };
    return listarPaginado(
      pag,
      {
        find: ({ skip, take }) => prisma.peca.findMany({ where, orderBy, skip, take }),
        count: () => prisma.peca.count({ where }),
      },
      search.trim().length > 0 ? 20 : undefined
    );
  },

  getById: async (id: number, oficinaId: number) => {
    return prisma.peca.findFirst({
      where: { id, deleted_at: null, oficina_id: oficinaId },
    });
  },

  create: async (data: any) => {
    const existing = await prisma.peca.findFirst({
      where: { nome: data.nome, oficina_id: data.oficina_id },
    });

    if (existing) {
      const reativado = await prisma.peca.update({
        where: { id: existing.id },
        data: {
          nome: data.nome,
          descricao: data.descricao ?? null,
          preco_custo: data.preco_custo,
          preco_venda: data.preco_venda,
          estoque: data.estoque ?? existing.estoque,
          deleted_at: null,
        },
      });
      return { ...reativado, _reativado: true };
    }

    const nova = await prisma.peca.create({
      data: {
        oficina_id: data.oficina_id,
        nome: data.nome,
        descricao: data.descricao ?? null,
        preco_custo: data.preco_custo,
        preco_venda: data.preco_venda,
        estoque: data.estoque ?? 0,
      },
    });
    return { ...nova, _reativado: false };
  },

  update: async (id: number, data: any, oficinaId: number) => {
    const existing = await prisma.peca.findFirst({ where: { id, oficina_id: oficinaId, deleted_at: null } });
    if (!existing) throw new Error("Peca nao encontrada nesta oficina.");
    return prisma.peca.update({
      where: { id },
      data: camposEditaveisPeca(data),
    });
  },

  delete: async (id: number, oficinaId: number) => {
    const existing = await prisma.peca.findFirst({ where: { id, oficina_id: oficinaId, deleted_at: null } });
    if (!existing) throw new Error("Peca nao encontrada nesta oficina.");

    return prisma.peca.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  },

  ajuste: async (id: number, tipo: "entrada" | "saida", quantidade: number, oficinaId: number) => {
    const peca = await prisma.peca.findFirst({ where: { id, oficina_id: oficinaId, deleted_at: null } });
    if (!peca) throw new Error("Peca nao encontrada.");
    if (quantidade <= 0) throw new Error("A quantidade deve ser maior que zero.");
    if (tipo === "saida" && peca.estoque < quantidade) {
      throw new Error(`Estoque insuficiente. Disponivel: ${peca.estoque}`);
    }
    return prisma.peca.update({
      where: { id },
      data: { estoque: tipo === "entrada" ? { increment: quantidade } : { decrement: quantidade } },
    });
  },
};
