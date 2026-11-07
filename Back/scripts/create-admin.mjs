import "dotenv/config";
import bcrypt from "bcryptjs";
// Prisma 7 gera o client em src/generated (TS): o script usa o build (npm run build) e o mesmo
// client da API, ja com o driver adapter configurado.
import { prisma } from "../dist/src/prisma/client.js";
import { ensureProfiles } from "../dist/src/services/admin/oficinas.service.js";

function required(name, aliases = []) {
  const value = [name, ...aliases].map((key) => process.env[key]).find(Boolean);
  if (!value) throw new Error(`Variavel obrigatoria ausente: ${name}`);
  return value.trim();
}

function optional(name) {
  return process.env[name]?.trim() || undefined;
}

/**
 * Oficina inicial com o proprietario e uma senha conhecida (deploy novo e CI). Pode rodar de novo:
 * reaproveita a oficina ativa de mesmo nome e o usuario de mesmo e-mail. O nome da oficina nao e
 * unico no banco, por isso a busca e por nome e nao um upsert.
 */
async function criarOficinaInicial({ oficina: od, gestor: gd }) {
  const senhaHash = await bcrypt.hash(gd.senha, 10);

  return prisma.$transaction(async (tx) => {
    const uf = od.uf.toUpperCase();
    const cidade =
      (await tx.cidade.findFirst({ where: { nome: od.cidade, uf } })) ??
      (await tx.cidade.create({ data: { nome: od.cidade, uf } }));

    const dados = {
      logradouro: od.logradouro,
      numero: od.numero,
      complemento: od.complemento ?? null,
      cep: od.cep,
      cidade_id: cidade.id,
      telefone: od.telefone ?? null,
      email: od.email ?? null,
    };
    const existente = await tx.oficina.findFirst({ where: { nome: od.nome, deleted_at: null }, orderBy: { id: "asc" } });
    const oficina = existente
      ? await tx.oficina.update({ where: { id: existente.id }, data: dados })
      : await tx.oficina.create({ data: { nome: od.nome, ...dados } });

    const perfilProprietario = await ensureProfiles(tx, oficina.id);

    const email = gd.email.toLowerCase();
    const usuario = await tx.usuario.upsert({
      where: { email },
      update: { nome: gd.nome, senha: senhaHash, tipo: "gestoroficina", status: "ativo", deleted_at: null },
      create: { nome: gd.nome, email, senha: senhaHash, tipo: "gestoroficina", status: "ativo" },
    });

    const vinculo = { perfil: "gestoroficina", perfil_acesso_id: perfilProprietario.id, status: "ativo" };
    await tx.usuario_oficina.upsert({
      where: { usuario_id_oficina_id: { usuario_id: usuario.id, oficina_id: oficina.id } },
      update: { ...vinculo, deleted_at: null },
      create: { usuario_id: usuario.id, oficina_id: oficina.id, ...vinculo },
    });

    await tx.oficina.update({ where: { id: oficina.id }, data: { gestor_usuario_id: usuario.id } });
    return { oficina, usuario };
  });
}

async function main() {
  const result = await criarOficinaInicial({
    oficina: {
      nome: required("OFICINA_NOME"),
      logradouro: required("OFICINA_LOGRADOURO"),
      numero: required("OFICINA_NUMERO"),
      cep: required("OFICINA_CEP"),
      cidade: required("OFICINA_CIDADE"),
      uf: required("OFICINA_UF"),
      complemento: optional("OFICINA_COMPLEMENTO"),
      telefone: optional("OFICINA_TELEFONE"),
      email: optional("OFICINA_EMAIL"),
    },
    gestor: {
      nome: required("ADMIN_NAME", ["ADMIN_NOME"]),
      email: required("ADMIN_EMAIL"),
      senha: required("ADMIN_PASSWORD", ["ADMIN_SENHA"]),
    },
  });

  console.log("Admin inicial pronto.");
  console.log(`Oficina: ${result.oficina.nome} (id ${result.oficina.id})`);
  console.log(`Usuario: ${result.usuario.email} (id ${result.usuario.id})`);
}

main()
  .catch((error) => {
    console.error("Falha ao criar admin inicial:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
