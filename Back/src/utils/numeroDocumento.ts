/** Número curto do orçamento/OS nas telas, links e notificações: 12 → "012". O PDF usa 4 dígitos (numeroDoc). */
export const numeroCurto = (id: number) => String(id).padStart(3, "0");
