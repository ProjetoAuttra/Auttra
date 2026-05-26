import type { Request } from "express";
import { prisma } from "../../prisma/client.js";

type AuditInput = {
  req?: Request;
  actorId?: number | null;
  oficinaId?: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  message: string;
  metadata?: Record<string, unknown> | null;
};

export const AdminAuditService = {
  async log(input: AuditInput) {
    const actorId = input.actorId ?? input.req?.user?.id ?? null;
    const ip = input.req?.ip ?? input.req?.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ?? null;
    const userAgent = input.req?.get("user-agent") ?? null;

    await prisma.admin_audit_log.create({
      data: {
        actor_id: actorId,
        oficina_id: input.oficinaId ?? null,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        message: input.message,
        metadata: input.metadata ?? undefined,
        ip,
        user_agent: userAgent,
      } as any,
    });
  },

  async listarPorOficina(oficinaId: number, take = 50) {
    return prisma.admin_audit_log.findMany({
      where: { oficina_id: oficinaId },
      take,
      orderBy: { created_at: "desc" },
      include: {
        actor: { select: { id: true, nome: true, email: true } },
      },
    });
  },
};
