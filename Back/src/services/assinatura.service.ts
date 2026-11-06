import { prisma } from "../prisma/client.js";

/**
 * Situação da assinatura da oficina, calculada na hora a partir do que está gravado:
 * não há rotina agendada virando o teste em "vencido". Fora do prazo (teste vencido ou
 * assinatura suspensa) a conta fica só leitura.
 */

export const DIAS_TESTE = 7;
const DIA_MS = 86_400_000;
const TTL_MS = 5_000;

export type StatusAssinatura = "teste" | "ativa" | "suspensa";
export type PlanoAssinatura = "mensal" | "semestral";
export type SituacaoAssinatura = "teste" | "teste_vencido" | "ativa" | "suspensa";

export type DadosAssinatura = {
  assinatura_status: StatusAssinatura;
  teste_termina_em: Date | null;
  assinatura_plano: PlanoAssinatura | null;
  assinatura_ativada_em: Date | null;
};

export const SELECT_ASSINATURA = {
  assinatura_status: true,
  teste_termina_em: true,
  assinatura_plano: true,
  assinatura_ativada_em: true,
} as const;

/** Fim do teste grátis que começa em `inicio`. */
export function fimDoTeste(inicio: Date = new Date(), dias = DIAS_TESTE) {
  return new Date(inicio.getTime() + dias * DIA_MS);
}

export function calcularAssinatura(dados: DadosAssinatura, agora: Date = new Date()) {
  const emTeste = dados.assinatura_status === "teste";
  // Teste sem data de fim não deveria existir; se existir, conta como vencido (não libera de graça).
  const vencido = emTeste && (!dados.teste_termina_em || dados.teste_termina_em.getTime() <= agora.getTime());
  const situacao: SituacaoAssinatura = emTeste ? (vencido ? "teste_vencido" : "teste") : dados.assinatura_status;

  // "Faltam X dias": arredonda para cima, então o último dia (menos de 24h) ainda mostra 1.
  const diasRestantes = !emTeste
    ? null
    : vencido
      ? 0
      : Math.ceil((dados.teste_termina_em!.getTime() - agora.getTime()) / DIA_MS);

  return {
    situacao,
    status: dados.assinatura_status,
    somenteLeitura: situacao === "teste_vencido" || situacao === "suspensa",
    plano: dados.assinatura_plano,
    testeTerminaEm: dados.teste_termina_em?.toISOString() ?? null,
    ativadaEm: dados.assinatura_ativada_em?.toISOString() ?? null,
    diasRestantes,
  };
}

export type Assinatura = ReturnType<typeof calcularAssinatura>;

// Guarda os dados crus por poucos segundos; a situação é recalculada a cada leitura,
// então o teste vence no minuto certo mesmo com o cache.
const cache = new Map<number, { dados: DadosAssinatura | null; expira: number }>();

async function dadosDaOficina(oficinaId: number) {
  const atual = cache.get(oficinaId);
  if (atual && atual.expira > Date.now()) return atual.dados;

  const dados = await prisma.oficina.findUnique({ where: { id: oficinaId }, select: SELECT_ASSINATURA });
  cache.set(oficinaId, { dados, expira: Date.now() + TTL_MS });
  return dados;
}

export const AssinaturaService = {
  /** Situação da assinatura da oficina, ou null se a oficina não existe. */
  async daOficina(oficinaId: number, agora: Date = new Date()) {
    const dados = await dadosDaOficina(oficinaId);
    return dados ? calcularAssinatura(dados, agora) : null;
  },

  /** A oficina está fora do prazo (teste vencido ou suspensa)? Oficina inexistente não é bloqueada aqui. */
  async somenteLeitura(oficinaId: number) {
    return (await this.daOficina(oficinaId))?.somenteLeitura ?? false;
  },
};

/** Descarta o cache (use depois de ativar, estender ou suspender). Sem id, limpa tudo. */
export function limparCacheAssinatura(oficinaId?: number) {
  if (oficinaId === undefined) cache.clear();
  else cache.delete(oficinaId);
}
