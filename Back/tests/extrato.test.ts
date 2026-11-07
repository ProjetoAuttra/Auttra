import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/prisma/client.js";
import { PagamentosService } from "../src/services/pagamentos.service.js";

const suffix = Date.now();

// Auditoria V1, B10: o extrato somava titulos pendentes, vencidos e cancelados como se fossem movimentos.
describe.skipIf(!process.env.DATABASE_URL)("extrato: só o dinheiro que entrou e saiu", () => {
  let cidadeId: number;
  let oficinaId: number;
  let clienteId: number;
  // Periodo = hoje (UTC); tz_offset 0 para o teste nao depender do fuso da maquina.
  const hoje = new Date().toISOString().slice(0, 10);
  const periodo = { pagamento_de: hoje, pagamento_ate: hoje, tz_offset: "0" };

  const titulo = (tipo: "receber" | "pagar", valor: number) =>
    PagamentosService.create({
      oficina_id: oficinaId,
      tipo,
      valor,
      data_vencimento: hoje,
      ...(tipo === "receber" ? { cliente_id: clienteId } : {}),
    }) as Promise<{ id: number }>;

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Ext ${suffix}`, uf: "SP" } })).id;
    oficinaId = (
      await prisma.oficina.create({ data: { nome: `Oficina Ext ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId } })
    ).id;
    clienteId = (await prisma.cliente.create({ data: { nome: "Cliente Ext", oficina_id: oficinaId } })).id;

    // Entra: 100 quitado hoje
    const a = await titulo("receber", 100);
    await PagamentosService.pagar(a.id, { metodo: "pix", data_pagamento: hoje }, oficinaId);
    // Entra: 50 de um recebimento parcial de 200 (o saldo de 150 fica pendente)
    const b = await titulo("receber", 200);
    await PagamentosService.pagamentoParcial(b.id, { valor_entrada: 50, metodo: "dinheiro" }, oficinaId);
    // Sai: 30 pago hoje
    const c = await titulo("pagar", 30);
    await PagamentosService.pagar(c.id, { metodo: "pix", data_pagamento: hoje }, oficinaId);

    // Não entram: pago fora do período, pago e estornado, pendente e cancelado
    const d = await titulo("receber", 70);
    await PagamentosService.pagar(d.id, { metodo: "pix", data_pagamento: "2020-01-15" }, oficinaId);
    const e = await titulo("receber", 40);
    await PagamentosService.pagar(e.id, { metodo: "pix", data_pagamento: hoje }, oficinaId);
    await PagamentosService.estornar(e.id, { motivo: "lançado errado" }, oficinaId);
    await titulo("receber", 500);
    const f = await titulo("pagar", 80);
    await prisma.pagamento.update({ where: { id: f.id }, data: { status: "cancelado" } });
  });

  afterAll(async () => {
    await prisma.pagamento_movimento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.pagamento.deleteMany({ where: { oficina_id: oficinaId, pagamento_pai_id: { not: null } } });
    await prisma.pagamento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.cliente.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.oficina.deleteMany({ where: { id: oficinaId } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  it("totais: entradas, saídas e saldo do período", async () => {
    const r = await PagamentosService.extratoResumo(oficinaId, periodo);
    expect(r).toEqual({ entradas: 150, saidas: 30, saldo: 120, taxas_cartao: 0, entradas_liquidas: 150, qtd_entradas: 2, qtd_saidas: 1 });
  });

  it("a lista com os mesmos filtros traz exatamente as linhas somadas", async () => {
    const linhas: any = await PagamentosService.list(oficinaId, { status: "pago", ...periodo, ordem: "pagamento" });
    const rows = Array.isArray(linhas) ? linhas : linhas.rows;
    expect(rows).toHaveLength(3);
    const soma = (tipo: string) => rows.filter((p: any) => p.tipo === tipo).reduce((t: number, p: any) => t + Number(p.valor_pago), 0);
    expect(soma("receber")).toBe(150);
    expect(soma("pagar")).toBe(30);
  });

  it("sem período, considera todos os pagos", async () => {
    const r = await PagamentosService.extratoResumo(oficinaId);
    expect(r.entradas).toBe(220);
  });
});
