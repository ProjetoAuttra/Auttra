import bcrypt from "bcrypt";
import { prisma } from "../../prisma/client.js";

const ACCESS_MODULES = [
  "painel", "agenda", "clientes", "veiculos", "estoque", "servicos",
  "ordens", "financeiro", "fornecedores", "orcamentos", "funcionarios",
  "relatorios", "configuracoes", "recursos_adicionais",
] as const;

const ALL_ACTIONS = ["read", "create", "update", "delete"];
const allPermissions = Object.fromEntries(ACCESS_MODULES.map((m) => [m, ALL_ACTIONS]));

const DEFAULT_PROFILES = [
  {
    nome: "Proprietario",
    descricao: "Acesso total a todos os modulos e acoes.",
    chave: "proprietario",
    padrao: true,
    permissoes: allPermissions,
  },
  {
    nome: "Mecanico",
    descricao: "Acesso operacional para execucao de servicos e consulta de cadastros.",
    chave: "mecanico",
    padrao: false,
    permissoes: {
      painel: ["read"],
      agenda: ["read", "update"],
      clientes: ["read"],
      veiculos: ["read"],
      estoque: ["read"],
      servicos: ["read"],
      ordens: ["read", "create", "update"],
      orcamentos: ["read", "create", "update"],
    },
  },
  {
    nome: "Recepcao",
    descricao: "Acesso para atendimento, agenda, clientes e abertura de ordens.",
    chave: "recepcao",
    padrao: false,
    permissoes: {
      painel: ["read"],
      agenda: ALL_ACTIONS,
      clientes: ["read", "create", "update"],
      veiculos: ["read", "create", "update"],
      estoque: ["read"],
      servicos: ["read"],
      ordens: ["read", "create", "update"],
      financeiro: ["read", "create", "update"],
      fornecedores: ["read"],
      orcamentos: ["read", "create", "update"],
      funcionarios: ["read"],
      relatorios: ["read"],
    },
  },
];

async function ensureProfiles(tx: any, oficinaId: number) {
  for (const perfil of DEFAULT_PROFILES) {
    await tx.perfil_acesso.upsert({
      where: { oficina_id_nome: { oficina_id: oficinaId, nome: perfil.nome } },
      update: {
        descricao: perfil.descricao,
        chave: perfil.chave,
        padrao: perfil.padrao,
        sistema: true,
        permissoes: perfil.permissoes,
        deleted_at: null,
      },
      create: {
        oficina_id: oficinaId,
        nome: perfil.nome,
        descricao: perfil.descricao,
        chave: perfil.chave,
        padrao: perfil.padrao,
        sistema: true,
        permissoes: perfil.permissoes,
      },
    });
  }

  return tx.perfil_acesso.findFirstOrThrow({
    where: { oficina_id: oficinaId, chave: "proprietario", deleted_at: null },
  });
}

export type CriarOficinaInput = {
  oficina: {
    nome: string;
    logradouro: string;
    numero: string;
    cep: string;
    cidade: string;
    uf: string;
    complemento?: string;
    telefone?: string;
    email?: string;
  };
  gestor: {
    nome: string;
    email: string;
    senha: string;
  };
};

export const OficinasAdminService = {
  async listar(q?: string) {
    const where: any = { deleted_at: null };
    if (q) {
      where.OR = [
        { nome: { contains: q, mode: "insensitive" } },
        { cnpj: { contains: q, mode: "insensitive" } },
        { telefone: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { gestor: { nome: { contains: q, mode: "insensitive" } } },
        { gestor: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const oficinas = await prisma.oficina.findMany({
      where,
      include: {
        cidade: true,
        gestor: { select: { id: true, nome: true, email: true } },
        _count: {
          select: {
            acessos: { where: { deleted_at: null, status: "ativo" } },
            ordens_servico: { where: { deleted_at: null, status: "aberta" } },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return oficinas.map((o) => ({
      id: o.id,
      nome: o.nome,
      cnpj: o.cnpj ?? null,
      cidade: o.cidade ? `${o.cidade.nome}/${o.cidade.uf}` : null,
      telefone: o.telefone ?? null,
      email: o.email ?? null,
      gestor: o.gestor ? { id: o.gestor.id, nome: o.gestor.nome, email: o.gestor.email } : null,
      total_usuarios: o._count.acessos,
      total_os_abertas: o._count.ordens_servico,
      criada_em: o.created_at,
      deleted_at: o.deleted_at ?? null,
    }));
  },

  async getById(id: number) {
    const oficina = await prisma.oficina.findFirst({
      where: { id, deleted_at: null },
      include: {
        cidade: true,
        acessos: {
          where: { deleted_at: null },
          include: { usuario: { select: { id: true, nome: true, email: true, tipo: true, status: true } } },
        },
      },
    });

    if (!oficina) throw new Error("Oficina não encontrada.");
    return oficina;
  },

  async criarOficinaCompleta({ oficina: oficinaData, gestor }: CriarOficinaInput) {
    return prisma.$transaction(async (tx) => {
      const cidade =
        (await tx.cidade.findFirst({ where: { nome: oficinaData.cidade, uf: oficinaData.uf.toUpperCase() } })) ??
        (await tx.cidade.create({ data: { nome: oficinaData.cidade, uf: oficinaData.uf.toUpperCase() } }));

      const oficina = await tx.oficina.upsert({
        where: { nome: oficinaData.nome },
        update: {
          logradouro: oficinaData.logradouro,
          numero: oficinaData.numero,
          complemento: oficinaData.complemento ?? null,
          cep: oficinaData.cep,
          cidade_id: cidade.id,
          telefone: oficinaData.telefone ?? null,
          email: oficinaData.email ?? null,
          deleted_at: null,
        },
        create: {
          nome: oficinaData.nome,
          logradouro: oficinaData.logradouro,
          numero: oficinaData.numero,
          complemento: oficinaData.complemento ?? null,
          cep: oficinaData.cep,
          cidade_id: cidade.id,
          telefone: oficinaData.telefone ?? null,
          email: oficinaData.email ?? null,
        },
      });

      const perfil = await ensureProfiles(tx, oficina.id);
      const senhaHash = await bcrypt.hash(gestor.senha, 10);

      const usuario = await tx.usuario.upsert({
        where: { email: gestor.email.toLowerCase() },
        update: {
          nome: gestor.nome,
          senha: senhaHash,
          tipo: "gestoroficina",
          status: "ativo",
          deleted_at: null,
        },
        create: {
          nome: gestor.nome,
          email: gestor.email.toLowerCase(),
          senha: senhaHash,
          tipo: "gestoroficina",
          status: "ativo",
        },
      });

      await tx.usuario_oficina.upsert({
        where: { usuario_id_oficina_id: { usuario_id: usuario.id, oficina_id: oficina.id } },
        update: { perfil: "gestoroficina", perfil_acesso_id: perfil.id, status: "ativo", deleted_at: null },
        create: { usuario_id: usuario.id, oficina_id: oficina.id, perfil: "gestoroficina", perfil_acesso_id: perfil.id, status: "ativo" },
      });

      await tx.oficina.update({
        where: { id: oficina.id },
        data: { gestor_usuario_id: usuario.id },
      });

      return { oficina, usuario };
    });
  },

  async update(id: number, data: Partial<{ logradouro: string; numero: string; cep: string; telefone: string; email: string; complemento: string }>) {
    const oficina = await prisma.oficina.findFirst({ where: { id, deleted_at: null } });
    if (!oficina) throw new Error("Oficina não encontrada.");
    return prisma.oficina.update({ where: { id }, data });
  },

  async softDelete(id: number) {
    const oficina = await prisma.oficina.findFirst({ where: { id, deleted_at: null } });
    if (!oficina) throw new Error("Oficina não encontrada.");

    return prisma.$transaction(async (tx) => {
      await tx.usuario_oficina.updateMany({
        where: { oficina_id: id, deleted_at: null },
        data: { deleted_at: new Date() },
      });
      return tx.oficina.update({ where: { id }, data: { deleted_at: new Date() } });
    });
  },

  async reativar(id: number) {
    const oficina = await prisma.oficina.findFirst({ where: { id } });
    if (!oficina) throw new Error("Oficina não encontrada.");
    if (!oficina.deleted_at) throw new Error("Oficina já está ativa.");

    return prisma.$transaction(async (tx) => {
      await tx.usuario_oficina.updateMany({
        where: { oficina_id: id },
        data: { deleted_at: null, status: "ativo" },
      });
      return tx.oficina.update({ where: { id }, data: { deleted_at: null } });
    });
  },
};
