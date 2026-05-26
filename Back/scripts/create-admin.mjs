import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// importa direto do JS compilado quando disponível, senão usa o cliente Prisma diretamente
// para manter o script compatível com execução fora do build TS, replica a lógica mínima aqui.

const prisma = new PrismaClient();

function required(name, aliases = []) {
  const value = [name, ...aliases].map((key) => process.env[key]).find(Boolean);
  if (!value) throw new Error(`Variavel obrigatoria ausente: ${name}`);
  return value.trim();
}

function optional(name) {
  return process.env[name]?.trim() || undefined;
}

// importação dinâmica do service compilado, com fallback inline
async function criarOficinaCompleta(input) {
  try {
    const { OficinasAdminService } = await import("../dist/services/admin/oficinas.service.js");
    return OficinasAdminService.criarOficinaCompleta(input);
  } catch {
    // fallback: executa inline quando dist/ não está disponível
    const bcrypt = (await import("bcryptjs")).default;

    const ACCESS_MODULES = [
      "painel","agenda","clientes","veiculos","estoque","servicos",
      "ordens","financeiro","fornecedores","orcamentos","funcionarios",
      "relatorios","configuracoes","recursos_adicionais",
    ];
    const ALL_ACTIONS = ["read","create","update","delete"];
    const allPermissions = Object.fromEntries(ACCESS_MODULES.map((m) => [m, ALL_ACTIONS]));

    const DEFAULT_PROFILES = [
      { nome: "Proprietario", descricao: "Acesso total a todos os modulos e acoes.", chave: "proprietario", padrao: true, permissoes: allPermissions },
      { nome: "Mecanico", descricao: "Acesso operacional para execucao de servicos e consulta de cadastros.", chave: "mecanico", padrao: false, permissoes: { painel:["read"],agenda:["read","update"],clientes:["read"],veiculos:["read"],estoque:["read"],servicos:["read"],ordens:["read","create","update"],orcamentos:["read","create","update"] } },
      { nome: "Recepcao", descricao: "Acesso para atendimento, agenda, clientes e abertura de ordens.", chave: "recepcao", padrao: false, permissoes: { painel:["read"],agenda:ALL_ACTIONS,clientes:["read","create","update"],veiculos:["read","create","update"],estoque:["read"],servicos:["read"],ordens:["read","create","update"],financeiro:["read","create","update"],fornecedores:["read"],orcamentos:["read","create","update"],funcionarios:["read"],relatorios:["read"] } },
    ];

    return prisma.$transaction(async (tx) => {
      const { oficina: od, gestor: gd } = input;
      const cidade =
        (await tx.cidade.findFirst({ where: { nome: od.cidade, uf: od.uf.toUpperCase() } })) ??
        (await tx.cidade.create({ data: { nome: od.cidade, uf: od.uf.toUpperCase() } }));

      const oficina = await tx.oficina.upsert({
        where: { nome: od.nome },
        update: { logradouro: od.logradouro, numero: od.numero, complemento: od.complemento ?? null, cep: od.cep, cidade_id: cidade.id, telefone: od.telefone ?? null, email: od.email ?? null, deleted_at: null },
        create: { nome: od.nome, logradouro: od.logradouro, numero: od.numero, complemento: od.complemento ?? null, cep: od.cep, cidade_id: cidade.id, telefone: od.telefone ?? null, email: od.email ?? null },
      });

      for (const perfil of DEFAULT_PROFILES) {
        await tx.perfil_acesso.upsert({
          where: { oficina_id_nome: { oficina_id: oficina.id, nome: perfil.nome } },
          update: { descricao: perfil.descricao, chave: perfil.chave, padrao: perfil.padrao, sistema: true, permissoes: perfil.permissoes, deleted_at: null },
          create: { oficina_id: oficina.id, nome: perfil.nome, descricao: perfil.descricao, chave: perfil.chave, padrao: perfil.padrao, sistema: true, permissoes: perfil.permissoes },
        });
      }

      const perfilProprietario = await tx.perfil_acesso.findFirstOrThrow({ where: { oficina_id: oficina.id, chave: "proprietario", deleted_at: null } });
      const senhaHash = await bcrypt.hash(gd.senha, 10);

      const usuario = await tx.usuario.upsert({
        where: { email: gd.email.toLowerCase() },
        update: { nome: gd.nome, senha: senhaHash, tipo: "gestoroficina", status: "ativo", deleted_at: null },
        create: { nome: gd.nome, email: gd.email.toLowerCase(), senha: senhaHash, tipo: "gestoroficina", status: "ativo" },
      });

      await tx.usuario_oficina.upsert({
        where: { usuario_id_oficina_id: { usuario_id: usuario.id, oficina_id: oficina.id } },
        update: { perfil: "gestoroficina", perfil_acesso_id: perfilProprietario.id, status: "ativo", deleted_at: null },
        create: { usuario_id: usuario.id, oficina_id: oficina.id, perfil: "gestoroficina", perfil_acesso_id: perfilProprietario.id, status: "ativo" },
      });

      await tx.oficina.update({ where: { id: oficina.id }, data: { gestor_usuario_id: usuario.id } });
      return { oficina, usuario };
    });
  }
}

async function main() {
  const result = await criarOficinaCompleta({
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
