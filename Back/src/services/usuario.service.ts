import { prisma } from "../prisma/client.js";
import bcrypt from "bcryptjs";
import type { tipo_usuario, status_usuario } from "@prisma/client";
import { PerfisAcessoService } from "./perfisAcesso.service.js";
import { invalidarTokens, limparCacheSessao } from "./sessao.service.js";

const TIPOS_PERMITIDOS: tipo_usuario[] = ["gestoroficina", "funcionario"];
const STATUS_PERMITIDOS: status_usuario[] = ["ativo", "inativo"];

function assertTipoPermitido(tipo: unknown): asserts tipo is tipo_usuario {
  if (!TIPOS_PERMITIDOS.includes(tipo as tipo_usuario)) {
    throw new Error("Tipo de usuario invalido.");
  }
}

// Nunca sai nas respostas do app: credenciais, controle de sessao/login e dados pessoais do proprietario.
const CAMPOS_PRIVADOS = {
  senha: true,
  totp_secret: true,
  token_version: true,
  failed_login_attempts: true,
  locked_until: true,
  last_login_ip: true,
  last_login_user_agent: true,
  cpf: true,
  telefone: true,
  data_nascimento: true,
} as const;

export const UsuarioService = {
  async create(data: {
    email: string;
    senha: string;
    nome: string;
    tipo?: tipo_usuario;
    status?: status_usuario;
    oficina_id: number;
    perfil_acesso_id?: number;
  }) {
    const email = data.email?.trim().toLowerCase();
    const { senha, nome, tipo = "gestoroficina", status = "ativo", oficina_id } = data;

    if (!email || !senha || !nome || !oficina_id) {
      throw new Error("E-mail, senha, nome e oficina_id sao obrigatorios.");
    }
    assertTipoPermitido(tipo);
    if (!STATUS_PERMITIDOS.includes(status)) throw new Error("Status invalido.");

    const oficina = await prisma.oficina.findUnique({ where: { id: oficina_id } });
    if (!oficina) throw new Error("Oficina nao encontrada.");

    const senhaHash = await bcrypt.hash(senha, 10);
    const perfilAcesso = data.perfil_acesso_id
      ? await prisma.perfil_acesso.findFirst({
          where: { id: Number(data.perfil_acesso_id), oficina_id, deleted_at: null },
        })
      : await PerfisAcessoService.findDefault(
          oficina_id,
          tipo === "gestoroficina" || tipo === "sistema" ? "proprietario" : "recepcao"
        );
    if (!perfilAcesso) throw new Error("Perfil de acesso nao encontrado.");

    const existing = await prisma.usuario.findUnique({ where: { email } });
    const usuario = existing
      ? await prisma.usuario.update({
          where: { id: existing.id },
          // usuario eh global (multi-oficina): nao sobrescreve nome/status de outra oficina
          data: { deleted_at: null },
          include: {
            acessos: { include: { oficina: { select: { id: true, nome: true } } } },
          },
        })
      : await prisma.usuario.create({
          data: {
            email,
            senha: senhaHash,
            nome,
            tipo,
            status,
          },
          include: {
            acessos: { include: { oficina: { select: { id: true, nome: true } } } },
          },
        });

    await prisma.usuario_oficina.upsert({
      where: { usuario_id_oficina_id: { usuario_id: usuario.id, oficina_id } },
      update: { perfil: tipo, perfil_acesso_id: perfilAcesso.id, status, deleted_at: null },
      create: {
        usuario_id: usuario.id,
        oficina_id,
        perfil: tipo,
        perfil_acesso_id: perfilAcesso.id,
        status,
      },
    });

    const usuarioComAcessos = await prisma.usuario.findUniqueOrThrow({
      where: { id: usuario.id },
      include: {
        acessos: { include: { oficina: { select: { id: true, nome: true } }, perfil_acesso: true } },
      },
    });

    return {
      id: usuarioComAcessos.id,
      nome: usuarioComAcessos.nome,
      email: usuarioComAcessos.email,
      tipo: usuarioComAcessos.tipo,
      status: usuarioComAcessos.status,
      oficinas: usuarioComAcessos.acessos.map((acesso) => ({
        id: acesso.oficina_id,
        nome: acesso.oficina.nome,
        perfil: acesso.perfil,
        perfil_acesso_id: acesso.perfil_acesso_id,
        perfil_acesso_nome: acesso.perfil_acesso?.nome,
        status: acesso.status,
      })),
    };
  },

  async list(oficinaId: number) {
    return prisma.usuario.findMany({
      omit: CAMPOS_PRIVADOS,
      where: {
        deleted_at: null,
        acessos: { some: { oficina_id: oficinaId, deleted_at: null } },
      },
      include: {
        acessos: {
          where: { oficina_id: oficinaId, deleted_at: null },
          include: { oficina: { select: { id: true, nome: true } } },
        },
      },
      orderBy: { id: "asc" },
    });
  },

  async getById(id: number, oficinaId: number) {
    const usuario = await prisma.usuario.findFirst({
      omit: CAMPOS_PRIVADOS,
      where: {
        id,
        deleted_at: null,
        acessos: { some: { oficina_id: oficinaId, deleted_at: null } },
      },
      include: {
        acessos: {
          where: { oficina_id: oficinaId, deleted_at: null },
          include: { oficina: { select: { id: true, nome: true } } },
        },
      },
    });
    if (!usuario) throw new Error("Usuario nao encontrado.");
    return usuario;
  },

  async update(id: number, data: { email?: string; senha?: string; nome?: string; tipo?: tipo_usuario; status?: status_usuario; oficina_id?: number }, oficinaId: number) {
    const usuario = await prisma.usuario.findFirst({
      where: {
        id,
        deleted_at: null,
        acessos: { some: { oficina_id: oficinaId, deleted_at: null } },
      },
    });
    if (!usuario) throw new Error("Usuario nao encontrado.");

    if (usuario.tipo === "sistema") throw new Error("Usuario nao encontrado.");

    const patch: { nome?: string; email?: string; senha?: string; status?: status_usuario; tipo?: tipo_usuario } = {};
    if (data.nome !== undefined) patch.nome = String(data.nome).trim();
    if (data.tipo !== undefined) {
      assertTipoPermitido(data.tipo);
      patch.tipo = data.tipo;
    }
    if (data.status !== undefined) {
      if (!STATUS_PERMITIDOS.includes(data.status)) throw new Error("Status invalido.");
      patch.status = data.status;
    }
    if (data.email) patch.email = data.email.trim().toLowerCase();
    if (data.senha) patch.senha = await bcrypt.hash(data.senha, 10);

    // email, senha e status sao globais: so podem mudar se o usuario pertence apenas a esta oficina
    if (patch.email || patch.senha || patch.status) {
      const outrosAcessos = await prisma.usuario_oficina.count({
        where: { usuario_id: id, oficina_id: { not: oficinaId }, deleted_at: null },
      });
      if (outrosAcessos > 0) {
        throw new Error("Este usuario tambem pertence a outra oficina; e-mail, senha e status nao podem ser alterados aqui.");
      }
    }

    if (patch.senha) Object.assign(patch, invalidarTokens);
    const atualizado = await prisma.usuario.update({ where: { id }, data: patch, omit: CAMPOS_PRIVADOS });
    limparCacheSessao(id);
    return atualizado;
  },

  async delete(id: number, oficinaId: number) {
    const usuario = await prisma.usuario.findFirst({
      where: {
        id,
        deleted_at: null,
        acessos: { some: { oficina_id: oficinaId, deleted_at: null } },
      },
    });
    if (!usuario) throw new Error("Usuario nao encontrado.");

    const outrosAcessos = await prisma.usuario_oficina.count({
      where: { usuario_id: id, oficina_id: { not: oficinaId }, deleted_at: null },
    });

    if (outrosAcessos > 0) {
      await prisma.usuario_oficina.update({
        where: { usuario_id_oficina_id: { usuario_id: id, oficina_id: oficinaId } },
        data: { deleted_at: new Date(), status: "inativo" },
      });
      limparCacheSessao(id);
      return this.getById(id, oficinaId).catch(() => ({ id, removedFromOffice: true }));
    }

    limparCacheSessao(id);
    return prisma.usuario.update({
      omit: CAMPOS_PRIVADOS,
      where: { id },
      data: {
        deleted_at: new Date(),
        status: "inativo",
              acessos: {
                updateMany: {
                  where: { oficina_id: oficinaId, deleted_at: null },
                  data: { deleted_at: new Date(), status: "inativo" },
                },
              },
      },
    });
  },
};
