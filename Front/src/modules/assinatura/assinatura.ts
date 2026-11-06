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

/** Dia de hoje em São Paulo (YYYY-MM-DD): a faixa fechada volta no dia seguinte. */
export const hojeSP = (agora = new Date()) => agora.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export const dataBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";

export function textoDiasRestantes(dias: number | null) {
  if (!dias || dias <= 1) return "Último dia do seu teste grátis.";
  return `Faltam ${dias} dias do seu teste grátis.`;
}

export type Faixa = {
  tom: "info" | "alerta";
  texto: string;
  /** Teste em andamento pode ser fechado (volta no dia seguinte); conta só leitura, não. */
  podeFechar: boolean;
  acao: "planos" | "falar";
};

/** O que a faixa do topo mostra em cada situação; assinatura ativa não tem faixa. */
export function faixaDaAssinatura(a: Assinatura | null): Faixa | null {
  if (!a) return null;
  switch (a.situacao) {
    case "teste":
      return {
        tom: "info",
        texto: `${textoDiasRestantes(a.diasRestantes)} Depois disso, você perde o acesso para criar e editar.`,
        podeFechar: true,
        acao: "planos",
      };
    case "teste_vencido":
      return {
        tom: "alerta",
        texto: "Seu teste grátis terminou. A conta está só para consulta: assine para voltar a criar e editar.",
        podeFechar: false,
        acao: "planos",
      };
    case "suspensa":
      return {
        tom: "alerta",
        texto: "Sua assinatura está suspensa. A conta está só para consulta até ser reativada.",
        podeFechar: false,
        acao: "falar",
      };
    default:
      return null;
  }
}
