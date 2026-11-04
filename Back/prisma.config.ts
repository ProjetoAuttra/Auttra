import "dotenv/config";
import { defineConfig } from "prisma/config";

// O Prisma 7 nao le mais o .env sozinho nem a URL do schema: a conexao do CLI (migrate, studio) vem daqui.
// process.env em vez de env(): `prisma generate` (build do Docker) roda sem DATABASE_URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
