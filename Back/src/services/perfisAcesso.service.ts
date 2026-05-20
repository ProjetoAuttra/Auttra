import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";
import {
  ACTION_LABELS,
  ACCESS_ACTIONS,
  ACCESS_MODULES,
  DEFAULT_ACCESS_PROFILES,
  MODULE_LABELS,
  normalizePermissions,
} from "../permissions/accessProfiles.js";

function serialize(perfil: any) {
  return {
    id: perfil.id,
    oficina_id: perfil.oficina_id,
    nome: perfil.nome,
    descricao: perfil.descricao,
    chave: perfil.chave,
    padrao: perfil.padrao,
    sistema: perfil.sistema,
    permissoes: normalizePermissions(perfil.permissoes),
    usuarios_vinculados: perfil._count?.acessos ?? 0,
  };
}

export const PerfisAcessoService = {
  metadata() {
    return {
      modules: ACCESS_MODULES.map((id) => ({ id, label: MODULE_LABELS[id] })),
      actions: ACCESS_ACTIONS.map((id) => ({ id, label: ACTION_LABELS[id] })),
    };
  },

  async ensureDefaults(oficinaId: number) {
    for (const perfil of DEFAULT_ACCESS_PROFILES) {
      await prisma.perfil_acesso.upsert({
        where: { oficina_id_nome: { oficina_id: oficinaId, nome: perfil.nome } },
        update: {
          descricao: perfil.descricao,
          chave: perfil.chave,
          padrao: perfil.padrao,
          sistema: true,
          permissoes: perfil.permissoes as Prisma.InputJsonValue,
          deleted_at: null,
        },
        create: {
          oficina_id: oficinaId,
          nome: perfil.nome,
          descricao: perfil.descricao,
          chave: perfil.chave,
          padrao: perfil.padrao,
          sistema: true,
          permissoes: perfil.permissoes as Prisma.InputJsonValue,
        },
      });
    }
  },

  async findDefault(oficinaId: number, chave = "recepcao") {
    await this.ensureDefaults(oficinaId);

    const exact = await prisma.perfil_acesso.findFirst({
      where: {
        oficina_id: oficinaId,
        deleted_at: null,
        chave,
      },
      orderBy: { id: "asc" },
    });
    if (exact) return exact;

    return prisma.perfil_acesso.findFirst({
      where: {
        oficina_id: oficinaId,
        deleted_at: null,
        padrao: true,
      },
      orderBy: { id: "asc" },
    });
  },

  async list(oficinaId: number) {
    await this.ensureDefaults(oficinaId);

    const perfis = await prisma.perfil_acesso.findMany({
      where: { oficina_id: oficinaId, deleted_at: null },
      include: { _count: { select: { acessos: true } } },
      orderBy: [{ padrao: "desc" }, { nome: "asc" }],
    });

    return perfis.map(serialize);
  },

  async getById(id: number, oficinaId: number) {
    const perfil = await prisma.perfil_acesso.findFirst({
      where: { id, oficina_id: oficinaId, deleted_at: null },
      include: { _count: { select: { acessos: true } } },
    });
    if (!perfil) throw new Error("Perfil de acesso nao encontrado.");
    return serialize(perfil);
  },

  async create(oficinaId: number, data: any) {
    const nome = String(data?.nome ?? "").trim();
    if (!nome) throw new Error("Nome do perfil e obrigatorio.");

    const existing = await prisma.perfil_acesso.findFirst({
      where: { oficina_id: oficinaId, nome },
    });

    if (existing) {
      const reativado = await prisma.perfil_acesso.update({
        where: { id: existing.id },
        data: {
          nome,
          descricao: data?.descricao ? String(data.descricao).trim() : null,
          sistema: false,
          padrao: Boolean(data?.padrao),
          permissoes: normalizePermissions(data?.permissoes) as Prisma.InputJsonValue,
          deleted_at: null,
        },
        include: { _count: { select: { acessos: true } } },
      });
      if (reativado.padrao) await this.setDefault(reativado.id, oficinaId);
      return this.getById(reativado.id, oficinaId);
    }

    const perfil = await prisma.perfil_acesso.create({
      data: {
        oficina_id: oficinaId,
        nome,
        descricao: data?.descricao ? String(data.descricao).trim() : null,
        chave: null,
        sistema: false,
        padrao: Boolean(data?.padrao),
        permissoes: normalizePermissions(data?.permissoes) as Prisma.InputJsonValue,
      },
      include: { _count: { select: { acessos: true } } },
    });

    if (perfil.padrao) await this.setDefault(perfil.id, oficinaId);
    return this.getById(perfil.id, oficinaId);
  },

  async update(id: number, oficinaId: number, data: any) {
    await this.getById(id, oficinaId);

    const patch: Prisma.perfil_acessoUpdateInput = {};
    if (data?.nome != null) patch.nome = String(data.nome).trim();
    if (data?.descricao !== undefined) {
      patch.descricao = data.descricao ? String(data.descricao).trim() : null;
    }
    if (data?.permissoes != null) {
      patch.permissoes = normalizePermissions(data.permissoes) as Prisma.InputJsonValue;
    }
    if (data?.padrao != null) patch.padrao = Boolean(data.padrao);

    const perfil = await prisma.perfil_acesso.update({
      where: { id },
      data: patch,
      include: { _count: { select: { acessos: true } } },
    });

    if (perfil.padrao) await this.setDefault(id, oficinaId);
    return this.getById(id, oficinaId);
  },

  async setDefault(id: number, oficinaId: number) {
    await prisma.$transaction([
      prisma.perfil_acesso.updateMany({
        where: { oficina_id: oficinaId, deleted_at: null, id: { not: id } },
        data: { padrao: false },
      }),
      prisma.perfil_acesso.update({
        where: { id },
        data: { padrao: true },
      }),
    ]);
  },

  async delete(id: number, oficinaId: number) {
    const perfil = await prisma.perfil_acesso.findFirst({
      where: { id, oficina_id: oficinaId, deleted_at: null },
      include: { _count: { select: { acessos: true } } },
    });
    if (!perfil) throw new Error("Perfil de acesso nao encontrado.");
    if (perfil.padrao) throw new Error("Nao e possivel excluir o perfil padrao.");
    if (perfil._count.acessos > 0) {
      throw new Error("Nao e possivel excluir um perfil vinculado a usuarios.");
    }

    return prisma.perfil_acesso.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  },
};
