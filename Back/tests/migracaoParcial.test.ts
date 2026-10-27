import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/prisma/client.js";

const suffix = Date.now();
const sql = fs
  .readFileSync(path.join(__dirname, "../prisma/migrations/20260602000000_pagamento_parcial_vira_saldo/migration.sql"), "utf8")
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n")
  .split(/;\s*\n/)
  .map((c) => c.trim())
  .filter(Boolean);

describe.skipIf(!process.env.DATABASE_URL)("migration: parcial vira titulo pago + saldo pendente", () => {
  let cidadeId: number;
  let oficinaId: number;
  let clienteId: number;

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Mig ${suffix}`, uf: "SP" } })).id;
    oficinaId = (
      await prisma.oficina.create({
        data: { nome: `Oficina Mig ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId },
      })
    ).id;
    clienteId = (await prisma.cliente.create({ data: { nome: "Cliente Mig", oficina_id: oficinaId } })).id;
  });

  afterAll(async () => {
    await prisma.pagamento_movimento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.pagamento.updateMany({ where: { oficina_id: oficinaId }, data: { pagamento_pai_id: null } });
    await prisma.pagamento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.cliente.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.oficina.deleteMany({ where: { id: oficinaId } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  it("converte o titulo parcial e deixa os demais como estao", async () => {
    const base = { oficina_id: oficinaId, cliente_id: clienteId, tipo: "receber" as const, data_vencimento: new Date("2026-11-01") };
    const parcial = await prisma.pagamento.create({
      data: { ...base, valor: 300, valor_original: 300, desconto: 20, valor_pago: 100, status: "parcial", descricao: "Entrada", metodo: "pix" },
    });
    await prisma.pagamento_movimento.create({ data: { pagamento_id: parcial.id, oficina_id: oficinaId, tipo: "pagamento", valor: 100, metodo: "pix" } });
    const pendente = await prisma.pagamento.create({ data: { ...base, valor: 50, valor_original: 50, status: "pendente" } });
    const pago = await prisma.pagamento.create({ data: { ...base, valor: 80, valor_original: 80, valor_pago: 80, status: "pago", data_pagamento: new Date() } });

    for (const comando of sql) await prisma.$executeRawUnsafe(comando);

    const original = await prisma.pagamento.findUniqueOrThrow({ where: { id: parcial.id } });
    expect(original.status).toBe("pago");
    expect(Number(original.valor_original)).toBe(120); // 100 pagos + 20 de desconto
    expect(Number(original.valor_pago)).toBe(100);
    expect(original.data_pagamento).not.toBeNull();

    const saldos = await prisma.pagamento.findMany({ where: { pagamento_pai_id: parcial.id } });
    expect(saldos).toHaveLength(1);
    expect(saldos[0]).toMatchObject({ status: "pendente", descricao: "Entrada", cliente_id: clienteId, observacao: `Saldo do título #${parcial.id}` });
    expect(Number(saldos[0].valor_original)).toBe(180); // 300 - 20 - 100
    expect(Number(saldos[0].desconto)).toBe(0);
    expect(Number(saldos[0].valor_pago)).toBe(0);

    expect((await prisma.pagamento.findUniqueOrThrow({ where: { id: pendente.id } })).status).toBe("pendente");
    expect((await prisma.pagamento.findUniqueOrThrow({ where: { id: pago.id } })).status).toBe("pago");
    expect(await prisma.pagamento.count({ where: { oficina_id: oficinaId, status: "parcial" } })).toBe(0);
  });
});
