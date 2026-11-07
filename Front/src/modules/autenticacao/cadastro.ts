/** Regras do formulário de cadastro pelo site (sem React, para testar e reaproveitar). */
export const SENHA_MIN = 6;
const UTMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export const CHAVE_UTM = "auttra:utm";

export type Campo = "nome" | "oficina" | "whatsapp" | "email" | "senha" | "aceite";
export type Erros = Partial<Record<Campo, string>>;

/** UTMs da landing: os da URL valem; sem eles, os guardados nesta aba (a pessoa pode ter recarregado). */
export function lerCampanha(params: URLSearchParams): Record<string, string> | null {
  const daUrl = Object.fromEntries(UTMS.flatMap((k) => (params.get(k)?.trim() ? [[k, params.get(k)!.trim()]] : [])));
  try {
    if (Object.keys(daUrl).length) {
      sessionStorage.setItem(CHAVE_UTM, JSON.stringify(daUrl));
      return daUrl;
    }
    const guardado = sessionStorage.getItem(CHAVE_UTM);
    return guardado ? JSON.parse(guardado) : null;
  } catch {
    return Object.keys(daUrl).length ? daUrl : null;
  }
}

export function validarCadastro(f: { nome: string; oficina: string; whatsapp: string; email: string; senha: string; aceite: boolean }): Erros {
  const erros: Erros = {};
  if (f.nome.trim().length < 2) erros.nome = "Informe seu nome.";
  if (f.oficina.trim().length < 2) erros.oficina = "Informe o nome da oficina.";
  const zap = f.whatsapp.replace(/\D/g, "");
  if (zap.length < 10 || zap.length > 11) erros.whatsapp = "Informe o WhatsApp com DDD.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) erros.email = "Informe um e-mail válido.";
  if (f.senha.length < SENHA_MIN) erros.senha = `A senha precisa de pelo menos ${SENHA_MIN} caracteres.`;
  if (!f.aceite) erros.aceite = "Para criar a conta, aceite os Termos de uso e a Política de Privacidade.";
  return erros;
}
