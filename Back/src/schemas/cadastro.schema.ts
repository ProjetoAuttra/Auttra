import { z } from "zod";
import { apenasDigitos } from "../utils/documentos.js";

export { primeiroErro } from "./admin/oficinas.schema.js";

/** Mesma regra de senha do resto do app (troca e redefinição): mínimo de 6. O bcrypt ignora o que passa de 72 bytes. */
export const SENHA_MIN = 6;
export const SENHA_MAX = 72;

const texto = (campo: string, max: number) =>
  z.string({ error: `Informe ${campo}.` }).trim()
    .min(2, `Informe ${campo}.`)
    .max(max, `${campo[0].toUpperCase()}${campo.slice(1)} pode ter no máximo ${max} caracteres.`);

const UTMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

/** UTMs da landing: só as chaves conhecidas, texto curto; o resto é descartado. */
const campanha = z.record(z.string(), z.unknown()).optional().transform((obj) => {
  if (!obj) return null;
  const limpos = Object.fromEntries(
    UTMS.flatMap((k) => (typeof obj[k] === "string" && obj[k].trim() ? [[k, obj[k].trim().slice(0, 200)]] : []))
  );
  return Object.keys(limpos).length ? limpos : null;
}).catch(null);

/** Cadastro pelo site: só o mínimo para entrar e usar. Endereço, CNPJ e logo ficam para Configurações. */
export const cadastroSchema = z.object({
  nome: texto("seu nome", 120),
  oficina: texto("o nome da oficina", 120),
  whatsapp: z.string({ error: "Informe o WhatsApp com DDD." })
    .transform(apenasDigitos)
    .refine((v) => v.length === 10 || v.length === 11, "WhatsApp deve ter 10 ou 11 dígitos, com DDD."),
  email: z.string({ error: "Informe seu e-mail." }).trim().toLowerCase()
    .max(254, "E-mail muito longo.")
    .pipe(z.email("E-mail inválido.")),
  senha: z.string({ error: "Crie uma senha." })
    .min(SENHA_MIN, `A senha deve ter pelo menos ${SENHA_MIN} caracteres.`)
    .max(SENHA_MAX, `A senha pode ter no máximo ${SENHA_MAX} caracteres.`),
  aceite_termos: z.literal(true, { error: "Para criar a conta, aceite os Termos de uso e a Política de Privacidade." }),
  campanha,
});

export type CadastroInput = z.infer<typeof cadastroSchema>;
