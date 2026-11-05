/** Só os dígitos de um telefone ("(11) 98765-4321" → "11987654321"). */
export const soDigitos = (valor?: string | null) => (valor ?? "").replace(/\D/g, "");

/**
 * Número no formato do wa.me: DDI 55 + DDD + número. Aceita o número com ou sem o 55;
 * qualquer outro tamanho é tratado como inválido e devolve "".
 */
export function numeroWhatsApp(telefone?: string | null) {
  const digitos = soDigitos(telefone);
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) return digitos;
  return "";
}

/**
 * Link que abre a conversa no WhatsApp com a mensagem pronta. Sem número válido, o WhatsApp
 * abre a mensagem para a pessoa escolher o contato.
 */
export function linkWhatsApp(telefone: string | null | undefined, texto: string) {
  return `https://wa.me/${numeroWhatsApp(telefone)}?text=${encodeURIComponent(texto)}`;
}
