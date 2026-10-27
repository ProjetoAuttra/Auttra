import { prisma } from "../prisma/client.js";

/**
 * Valida, a cada requisição, que o usuário do JWT ainda pode usar a sessão:
 * conta ativa, versão do token atual (trocar a senha invalida os tokens antigos)
 * e, para tokens de oficina, vínculo ativo com ela.
 * O resultado fica em cache por poucos segundos para não somar uma consulta por requisição.
 */

const TTL_MS = 5_000;

type Estado = { tokenVersion: number; ativo: boolean; vinculoAtivo: boolean; expira: number };
const cache = new Map<string, Estado>();

const chave = (usuarioId: number, oficinaId: number | null) => `${usuarioId}:${oficinaId ?? "-"}`;

async function carregar(usuarioId: number, oficinaId: number | null): Promise<Estado> {
  const [usuario, vinculo] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { token_version: true, status: true, deleted_at: true },
    }),
    oficinaId
      ? prisma.usuario_oficina.findUnique({
          where: { usuario_id_oficina_id: { usuario_id: usuarioId, oficina_id: oficinaId } },
          select: { status: true, deleted_at: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    tokenVersion: usuario?.token_version ?? -1,
    ativo: !!usuario && usuario.status === "ativo" && !usuario.deleted_at,
    vinculoAtivo: oficinaId ? !!vinculo && vinculo.status === "ativo" && !vinculo.deleted_at : true,
    expira: Date.now() + TTL_MS,
  };
}

export async function sessaoValida(claims: { id: number; tv?: number; oficinaId?: number; oficina_id?: number }) {
  const oficinaId = Number(claims.oficinaId ?? claims.oficina_id) || null;
  const k = chave(claims.id, oficinaId);

  let estado = cache.get(k);
  if (!estado || estado.expira <= Date.now()) {
    estado = await carregar(claims.id, oficinaId);
    cache.set(k, estado);
  }

  return estado.ativo && estado.vinculoAtivo && estado.tokenVersion === (claims.tv ?? 0);
}

/** Descarta o cache do usuário (use depois de alterar senha, status ou vínculos). */
export function limparCacheSessao(usuarioId: number) {
  for (const k of cache.keys()) if (k.startsWith(`${usuarioId}:`)) cache.delete(k);
}

/** Dado do `data` do Prisma que invalida todos os tokens emitidos antes. */
export const invalidarTokens = { token_version: { increment: 1 } } as const;

export function limparCacheSessoes() {
  cache.clear();
}
