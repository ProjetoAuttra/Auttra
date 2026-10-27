import { prisma } from "../src/prisma/client.js";

/** Cria um usuário ativo com acesso ativo às oficinas informadas, como o login real exigiria. */
export async function criarUsuarioComAcesso(oficinaIds: number[], tag: string, nome = "Teste") {
  const usuario = await prisma.usuario.create({
    data: { email: `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`, senha: "x", nome },
  });
  for (const oficina_id of oficinaIds) {
    await prisma.usuario_oficina.create({
      data: { usuario_id: usuario.id, oficina_id, perfil: "gestoroficina", status: "ativo" },
    });
  }
  return usuario.id;
}

export async function removerUsuario(id: number) {
  await prisma.usuario_oficina.deleteMany({ where: { usuario_id: id } });
  await prisma.usuario.deleteMany({ where: { id } });
}
