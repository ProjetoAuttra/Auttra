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
    cnpj?: string;
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

export type ListarOficinasParams = {
  q?: string;
  status?: "ativas" | "inativas" | "todas" | "implantacao" | "ativa" | "suspensa" | "cancelada";
  cidade?: string;
  gestor?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "nome" | "cidade" | "created_at" | "total_usuarios" | "total_os_abertas";
  sortDir?: "asc" | "desc";
};

function normalizePage(page?: number) {
  return Number.isFinite(page) && page && page > 0 ? Math.floor(page) : 1;
}

function normalizePageSize(pageSize?: number) {
  if (!Number.isFinite(pageSize) || !pageSize || pageSize <= 0) return 10;
  return Math.min(Math.floor(pageSize), 100);
}

function mapOficina(o: any) {
  return {
    id: o.id,
    nome: o.nome,
    cnpj: o.cnpj ?? null,
    cidade: o.cidade ? `${o.cidade.nome}/${o.cidade.uf}` : null,
    telefone: o.telefone ?? null,
    email: o.email ?? null,
    gestor: o.gestor ? { id: o.gestor.id, nome: o.gestor.nome, email: o.gestor.email } : null,
    total_usuarios: o._count?.acessos ?? 0,
    total_os_abertas: o._count?.ordens_servico ?? 0,
    criada_em: o.created_at,
    status_admin: o.status_admin,
    deleted_at: o.deleted_at ?? null,
  };
}

export const OficinasAdminService = {
  async listar(params: ListarOficinasParams = {}) {
    const page = normalizePage(params.page);
    const pageSize = normalizePageSize(params.pageSize);
    const where: any = {};

    if (!params.status || params.status === "ativas") where.deleted_at = null;
    if (params.status === "inativas") where.deleted_at = { not: null };
    if (params.status && ["implantacao", "ativa", "suspensa", "cancelada"].includes(params.status)) {
      where.deleted_at = null;
      where.status_admin = params.status;
    }

    if (params.q) {
      where.OR = [
        { nome: { contains: params.q, mode: "insensitive" } },
        { cnpj: { contains: params.q, mode: "insensitive" } },
        { telefone: { contains: params.q, mode: "insensitive" } },
        { email: { contains: params.q, mode: "insensitive" } },
        { gestor: { nome: { contains: params.q, mode: "insensitive" } } },
        { gestor: { email: { contains: params.q, mode: "insensitive" } } },
        { cidade: { nome: { contains: params.q, mode: "insensitive" } } },
      ];
    }
    if (params.cidade) where.cidade = { nome: { contains: params.cidade, mode: "insensitive" } };
    if (params.gestor) {
      where.gestor = {
        OR: [
          { nome: { contains: params.gestor, mode: "insensitive" } },
          { email: { contains: params.gestor, mode: "insensitive" } },
        ],
      };
    }

    const orderBy =
      params.sortBy === "nome" ? { nome: params.sortDir ?? "asc" } :
      params.sortBy === "cidade" ? { cidade: { nome: params.sortDir ?? "asc" } } :
      { created_at: params.sortDir ?? "desc" };

    const [total, oficinas] = await Promise.all([
      prisma.oficina.count({ where }),
      prisma.oficina.findMany({
        where,
        include: {
          cidade: true,
          gestor: { select: { id: true, nome: true, email: true } },
          _count: {
            select: {
              acessos: { where: { deleted_at: null, status: "ativo" } },
              ordens_servico: { where: { deleted_at: null, status: { in: ["aberta", "em_andamento"] } } },
            },
          },
        },
        orderBy: orderBy as any,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: oficinas.map(mapOficina),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  async getById(id: number) {
    const oficina = await prisma.oficina.findFirst({
      where: { id },
      include: {
        cidade: true,
        gestor: { select: { id: true, nome: true, email: true } },
        acessos: {
          where: { deleted_at: null },
          include: { usuario: { select: { id: true, nome: true, email: true, tipo: true, status: true, last_login_at: true } as any } },
        },
        _count: {
          select: {
            clientes: { where: { deleted_at: null } },
            veiculos: { where: { deleted_at: null } },
            ordens_servico: { where: { deleted_at: null, status: { in: ["aberta", "em_andamento"] } } },
          },
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
          cnpj: oficinaData.cnpj || null,
          logradouro: oficinaData.logradouro,
          numero: oficinaData.numero,
          complemento: oficinaData.complemento ?? null,
          cep: oficinaData.cep,
          cidade_id: cidade.id,
          telefone: oficinaData.telefone ?? null,
          email: oficinaData.email ?? null,
          status_admin: "implantacao",
          deleted_at: null,
        } as any,
        create: {
          nome: oficinaData.nome,
          cnpj: oficinaData.cnpj || null,
          logradouro: oficinaData.logradouro,
          numero: oficinaData.numero,
          complemento: oficinaData.complemento ?? null,
          cep: oficinaData.cep,
          cidade_id: cidade.id,
          telefone: oficinaData.telefone ?? null,
          email: oficinaData.email ?? null,
          status_admin: "implantacao",
        } as any,
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
        data: {
          gestor_usuario_id: usuario.id,
          implantacao_checklist: {
            dados_completos: true,
            gestor_criado: true,
            perfis_criados: true,
            primeiro_acesso: false,
            logo_cadastrada: false,
            usuarios_convidados: false,
          },
        } as any,
      });

      return { oficina, usuario };
    });
  },

  async update(id: number, data: Partial<{
    nome: string;
    cnpj: string | null;
    logradouro: string;
    numero: string;
    cep: string;
    cidade: string;
    uf: string;
    telefone: string | null;
    email: string | null;
    complemento: string | null;
    gestor_usuario_id: number | null;
    status_admin: "implantacao" | "ativa" | "suspensa" | "cancelada";
    notas_internas: string | null;
    implantacao_checklist: Record<string, boolean>;
  }>) {
    const oficina = await prisma.oficina.findFirst({ where: { id } });
    if (!oficina) throw new Error("Oficina não encontrada.");

    const updateData: any = { ...data };
    delete updateData.cidade;
    delete updateData.uf;

    if (data.cidade || data.uf) {
      const cidadeNome = data.cidade;
      const uf = data.uf?.toUpperCase();
      if (!cidadeNome || !uf) throw new Error("Cidade e UF devem ser informadas juntas.");
      const cidade =
        (await prisma.cidade.findFirst({ where: { nome: cidadeNome, uf } })) ??
        (await prisma.cidade.create({ data: { nome: cidadeNome, uf } }));
      updateData.cidade_id = cidade.id;
    }

    if (typeof data.gestor_usuario_id === "number") {
      const gestor = await prisma.usuario.findFirst({
        where: {
          id: data.gestor_usuario_id,
          deleted_at: null,
          tipo: { not: "sistema" },
          acessos: { some: { oficina_id: id, deleted_at: null, status: "ativo" } },
        },
      });
      if (!gestor) throw new Error("Gestor inválido para esta oficina.");
    }

    return prisma.oficina.update({ where: { id }, data: updateData });
  },

  async softDelete(id: number) {
    const oficina = await prisma.oficina.findFirst({ where: { id, deleted_at: null } });
    if (!oficina) throw new Error("Oficina não encontrada.");

    return prisma.$transaction(async (tx) => {
      await tx.usuario_oficina.updateMany({
        where: { oficina_id: id, deleted_at: null },
        data: { deleted_at: new Date() },
      });
      return tx.oficina.update({ where: { id }, data: { deleted_at: new Date(), status_admin: "suspensa" } as any });
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
      return tx.oficina.update({ where: { id }, data: { deleted_at: null, status_admin: "ativa" } as any });
    });
  },
};
