import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

// Log de cada query so em desenvolvimento (ou com PRISMA_LOG_QUERIES=true): em producao ele custa
// CPU/IO e joga valores de parametros no log do Railway.
const logQueries =
  process.env.PRISMA_LOG_QUERIES === "true" ||
  (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test");

// Prisma 7 conecta pelo driver `pg`. O pool do pg nao tem timeout de conexao por padrao; 5s e o
// que o Prisma 6 usava. DATABASE_POOL_MAX limita conexoes por instancia (padrao do pg: 10).
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5_000,
  max: Number(process.env.DATABASE_POOL_MAX) || 10,
});

export const prisma = new PrismaClient({
  adapter,
  log: logQueries ? ["query", "error", "warn"] : ["error", "warn"],
});
