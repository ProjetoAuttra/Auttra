import { linkWhatsApp } from "../../utils/whatsapp";

export type SituacaoAssinatura = "teste" | "teste_vencido" | "ativa" | "suspensa";
export type PlanoAssinatura = "mensal" | "semestral";

/** Resposta de GET /assinatura. */
export type Assinatura = {
  situacao: SituacaoAssinatura;
  status: "teste" | "ativa" | "suspensa";
  somenteLeitura: boolean;
  plano: PlanoAssinatura | null;
  testeTerminaEm: string | null;
  ativadaEm: string | null;
  diasRestantes: number | null;
};

// Mesmos valores do site (Landing Page/src/site/config.ts): mudou lá, muda aqui.
export const PLANOS: Record<PlanoAssinatura, { nome: string; precoMensal: number; condicoes: string }> = {
  semestral: { nome: "Semestral", precoMensal: 42.9, condicoes: "por oficina, contrato de 6 meses no cartão de crédito" },
  mensal: { nome: "Mensal", precoMensal: 54.9, condicoes: "por oficina, sem contrato" },
};

/** Desconto do semestral sobre o mensal, arredondado para baixo (nunca promete mais do que dá). */
export const DESCONTO_SEMESTRAL = Math.floor((1 - PLANOS.semestral.precoMensal / PLANOS.mensal.precoMensal) * 100);

/** WhatsApp do comercial (o mesmo do site). Na fase manual, assinar é uma conversa com a equipe. */
const WHATSAPP_VENDAS = import.meta.env.VITE_WHATSAPP_VENDAS || "5548991268901";

export const formatarPreco = (valor: number) => valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Oficina = { nome?: string | null; id?: number | null };

export function linkAssinar(plano: PlanoAssinatura, oficina: Oficina) {
  const linhas = [`Olá! Quero assinar o plano ${PLANOS[plano].nome.toLowerCase()} do Auttra.`, textoOficina(oficina)];
  return linkWhatsApp(WHATSAPP_VENDAS, linhas.filter(Boolean).join("\n"));
}

export function linkFalarComEquipe(oficina: Oficina, assunto = "Quero falar sobre a assinatura do Auttra.") {
  return linkWhatsApp(WHATSAPP_VENDAS, [`Olá! ${assunto}`, textoOficina(oficina)].filter(Boolean).join("\n"));
}

const textoOficina = ({ nome, id }: Oficina) => (nome ? `Oficina: ${nome}${id ? ` (código ${id})` : ""}` : "");

/**
 * Faixa do topo fechada pelo X: guarda o dia (em São Paulo) em que foi fechada. Vale só para esse dia:
 * no dia seguinte, ou num novo login (o AuthContext apaga a marca), ela volta.
 */
export const CHAVE_FAIXA_FECHADA = "auttra:faixa-assinatura-fechada";

/** Dia de hoje em São Paulo (YYYY-MM-DD). */
export const hojeSP = (agora = new Date()) => agora.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Altura da faixa (variável CSS): a barra do topo, o menu e o conteúdo descem junto com ela. */
export const VAR_ALTURA_FAIXA = "--faixa-assinatura-altura";
export const ALTURA_FAIXA = `var(${VAR_ALTURA_FAIXA}, 0px)`;

export const dataBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";

/** Dias de calendário até o último dia do teste: 0 = hoje é o último dia (o teste vai até 23:59). */
export function textoDiasRestantes(dias: number | null) {
  if (!dias) return "Último dia do seu teste grátis";
  return dias === 1 ? "Falta 1 dia do seu teste grátis" : `Faltam ${dias} dias do seu teste grátis`;
}

export type Faixa = {
  tom: "info" | "alerta" | "erro";
  /** Começo da frase, em negrito (como "Faltam 7 dias do seu teste grátis:"). */
  titulo: string;
  texto: string;
};

/** O que a faixa do topo mostra em cada situação; assinatura ativa não tem faixa. */
export function faixaDaAssinatura(a: Assinatura | null): Faixa | null {
  if (!a) return null;
  switch (a.situacao) {
    case "teste": {
      return {
        tom: "info",
        titulo: `${textoDiasRestantes(a.diasRestantes)}:`,
        texto: "depois disso, você perde o acesso para criar e editar. Adquira o Premium para continuar usando tudo.",
      };
    }
    case "teste_vencido":
      return {
        tom: "alerta",
        titulo: "Seu teste grátis terminou:",
        texto: "a conta está só para consulta. Adquira o Premium para voltar a criar e editar.",
      };
    case "suspensa":
      return {
        tom: "erro",
        titulo: "Assinatura suspensa:",
        texto: "a conta está só para consulta. Adquira o Premium para voltar a criar e editar.",
      };
    default:
      return null;
  }
}
