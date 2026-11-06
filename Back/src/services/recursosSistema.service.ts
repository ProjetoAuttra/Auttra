import { prisma } from "../prisma/client.js";

export const SYSTEM_RESOURCE_KEYS = ["agenda", "estoque", "fornecedores"] as const;

export type SystemResourceKey = (typeof SYSTEM_RESOURCE_KEYS)[number];
export type SystemResourcesMap = Record<SystemResourceKey, boolean>;

export const DEFAULT_SYSTEM_RESOURCES: SystemResourcesMap = {
  agenda: true,
  estoque: true,
  fornecedores: true,
};

function normalize(value: unknown): SystemResourcesMap {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return SYSTEM_RESOURCE_KEYS.reduce((acc, key) => {
    acc[key] = typeof input[key] === "boolean" ? Boolean(input[key]) : DEFAULT_SYSTEM_RESOURCES[key];
    return acc;
  }, {} as SystemResourcesMap);
}

export const RecursosSistemaService = {
  async get(oficinaId: number) {
    const [oficina] = await prisma.$queryRaw<Array<{ recursos_sistema: unknown }>>`
      SELECT recursos_sistema
      FROM "oficina"
      WHERE id = ${oficinaId} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!oficina) throw new Error("Oficina nao encontrada.");
    return normalize(oficina.recursos_sistema);
  },

  async update(oficinaId: number, data: unknown) {
    const recursos = normalize(data);
    await prisma.$executeRaw`
      UPDATE "oficina"
      SET recursos_sistema = CAST(${JSON.stringify(recursos)} AS jsonb)
      WHERE id = ${oficinaId} AND deleted_at IS NULL
    `;
    return recursos;
  },
};
