// Regra de senha dos usuarios do painel admin (tipo "sistema"), aplicada em todo lugar
// onde essa senha e definida: troca pelo proprio usuario e redefinicao por link.
const SENHA_FORTE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const SENHA_FORTE_MENSAGEM =
  "A senha deve ter no mínimo 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial.";

export function senhaForte(senha: string) {
  return SENHA_FORTE.test(senha);
}
