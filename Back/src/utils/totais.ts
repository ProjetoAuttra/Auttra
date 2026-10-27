import { Prisma } from "@prisma/client";

export type ItemCalculado = {
  tipo_item: "servico" | "peca";
  servico_id: number | null;
  peca_id: number | null;
  quantidade: number;
  preco_unitario: Prisma.Decimal;
  subtotal: Prisma.Decimal;
};

/**
 * Normaliza os itens e recalcula subtotal (quantidade x preco unitario) e total no servidor.
 * O preco unitario continua vindo do cliente (pode ser negociado); subtotal e total nunca sao confiados.
 */
export function calcularItens(itens: any[] | undefined | null): { itens: ItemCalculado[]; total: Prisma.Decimal } {
  let total = new Prisma.Decimal(0);
  const calculados = (itens ?? []).map((i: any): ItemCalculado => {
    const tipo = i.tipo_item ?? i.tipo ?? "servico";
    if (tipo !== "servico" && tipo !== "peca") throw new Error("Tipo de item invalido.");

    const quantidade = Number(i.quantidade ?? 1);
    if (!Number.isInteger(quantidade) || quantidade <= 0) throw new Error("Quantidade do item deve ser um inteiro maior que zero.");

    const preco = Number(i.preco_unitario ?? i.preco ?? 0);
    if (!Number.isFinite(preco) || preco < 0) throw new Error("Preco unitario do item invalido.");

    const preco_unitario = new Prisma.Decimal(preco).toDecimalPlaces(2);
    const subtotal = preco_unitario.times(quantidade);
    total = total.plus(subtotal);

    return {
      tipo_item: tipo,
      servico_id: tipo === "servico" ? i.servico_id ?? null : null,
      peca_id: tipo === "peca" ? i.peca_id ?? null : null,
      quantidade,
      preco_unitario,
      subtotal,
    };
  });
  return { itens: calculados, total };
}
