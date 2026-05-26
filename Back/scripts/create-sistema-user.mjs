import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function required(name, aliases = []) {
  const value = [name, ...aliases].map((key) => process.env[key]).find(Boolean);
  if (!value) {
    throw new Error(`Variavel obrigatoria ausente: ${name}`);
  }
  return value.trim();
}

async function main() {
  const email = required("SISTEMA_EMAIL").toLowerCase();
  const senha = required("SISTEMA_PASSWORD", ["SISTEMA_SENHA"]);
  const nome = required("SISTEMA_NAME", ["SISTEMA_NOME"]);

  if (senha.length < 32) {
    throw new Error("SISTEMA_PASSWORD deve ter pelo menos 32 caracteres.");
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  const usuario = await prisma.usuario.upsert({
    where: { email },
    update: {
      nome,
      senha: senhaHash,
      tipo: "sistema",
      status: "ativo",
      deleted_at: null,
    },
    create: {
      nome,
      email,
      senha: senhaHash,
      tipo: "sistema",
      status: "ativo",
    },
  });

  console.log("Usuário sistema criado/atualizado.");
  console.log(`Email: ${usuario.email} (id ${usuario.id})`);
}

main()
  .catch((error) => {
    console.error("Falha ao criar usuário sistema:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
