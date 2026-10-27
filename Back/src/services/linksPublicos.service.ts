import { prisma } from "../prisma/client.js";

type Alvo = { osId: number } | { orcamentoId: number };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const whereAlvo = (alvo: Alvo) =>
  "osId" in alvo ? { ordem_servico_id: alvo.osId } : { orcamento_id: alvo.orcamentoId };

async function assertAlvoDaOficina(alvo: Alvo, oficinaId: number) {
  if ("osId" in alvo) {
    const os = await prisma.ordem_servico.findFirst({
      where: { id: alvo.osId, oficina_id: oficinaId, deleted_at: null },
      select: { id: true },
    });
    if (!os) throw new Error("Ordem de servico nao encontrada nesta oficina.");
    return;
  }
  const orcamento = await prisma.orcamento.findFirst({
    where: { id: alvo.orcamentoId, deleted_at: null, cliente: { oficina_id: oficinaId } },
    select: { id: true },
  });
  if (!orcamento) throw new Error("Orcamento nao encontrado nesta oficina.");
}

export const LinksPublicosService = {
  /** Retorna o link ativo do documento ou cria um novo. O codigo publico eh o UUID. */
  async obterOuCriar(alvo: Alvo, oficinaId: number) {
    await assertAlvoDaOficina(alvo, oficinaId);

    const existente = await prisma.link_publico.findFirst({
      where: { ...whereAlvo(alvo), oficina_id: oficinaId, status: "ativo", deleted_at: null },
      select: { id: true },
    });
    if (existente) return existente.id;

    const criado = await prisma.link_publico.create({
      data: { ...whereAlvo(alvo), oficina_id: oficinaId },
      select: { id: true },
    });
    return criado.id;
  },

  /** Resolve o codigo publico. Links cancelados (soft delete) deixam de existir. */
  async resolver(codigo: string) {
    if (!UUID_RE.test(codigo)) return null;
    const link = await prisma.link_publico.findFirst({
      where: { id: codigo.toLowerCase(), status: "ativo", deleted_at: null },
    });
    if (!link) return null;
    return {
      oficinaId: link.oficina_id,
      osId: link.ordem_servico_id ?? undefined,
      orcamentoId: link.orcamento_id ?? undefined,
    };
  },

  /** Cancela (soft delete) todos os links ativos do documento. Retorna quantos foram cancelados. */
  async cancelar(alvo: Alvo, oficinaId: number) {
    const { count } = await prisma.link_publico.updateMany({
      where: { ...whereAlvo(alvo), oficina_id: oficinaId, status: "ativo", deleted_at: null },
      data: { status: "cancelado", deleted_at: new Date() },
    });
    return count;
  },
};
