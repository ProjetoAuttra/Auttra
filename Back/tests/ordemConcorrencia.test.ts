import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/prisma/client.js";
import { OrdensService } from "../src/services/ordens.service.js";

const suffix = Date.now();

// Auditoria V1, B7: concluir/cancelar/excluir a OS em paralelo duplicava titulo e estoque.
describe.skipIf(!process.env.DATABASE_URL)("OS: transições concorrentes", () => {
  let cidadeId: number;
  let oficinaId: number;
  let clienteId: number;
  let veiculoId: number;
  let funcionarioId: number;

  const novaPeca = async (estoque: number) =>
    (await prisma.peca.create({ data: { oficina_id: oficinaId, nome: `Peca Conc ${Math.random()}`, preco_custo: 10, preco_venda: 50, estoque } })).id;

  /** Cria a OS pelo service (baixa 2 unidades da peca) e leva ate o status pedido. */
  async function novaOs(pecaId: number, ate: "aberta" | "em_andamento") {
    const os: any = await OrdensService.create({
      oficina_id: oficinaId,
      cliente_id: clienteId,
      veiculo_id: veiculoId,
      funcionario_id: funcionarioId,
      itens: [{ tipo_item: "peca", peca_id: pecaId, nome: "Peca", quantidade: 2, preco_unitario: 50, subtotal: 100 }],
    });
    if (ate === "em_andamento") await OrdensService.update(os.id, { status: "em_andamento" }, oficinaId);
    return os.id as number;
  }
  const estoque = async (pecaId: number) => (await prisma.peca.findUniqueOrThrow({ where: { id: pecaId } })).estoque;

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Conc ${suffix}`, uf: "SP" } })).id;
    oficinaId = (
      await prisma.oficina.create({ data: { nome: `Oficina Conc ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId } })
    ).id;
    clienteId = (await prisma.cliente.create({ data: { nome: "Cliente Conc", oficina_id: oficinaId } })).id;
    veiculoId = (
      await prisma.veiculo.create({ data: { marca: "Fiat", modelo: "Uno", placa: `CON${suffix % 10000}`, oficina_id: oficinaId, cliente_id: clienteId } })
    ).id;
    funcionarioId = (
      await prisma.funcionario.create({ data: { nome: "Mecanico Conc", cargo: "mecanico", data_contratacao: new Date(), oficina_id: oficinaId } })
    ).id;
  });

  afterAll(async () => {
    await prisma.pagamento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.item_ordem_servico.deleteMany({ where: { ordem_servico: { oficina_id: oficinaId } } });
    await prisma.ordem_servico.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.peca.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.funcionario.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.veiculo.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.cliente.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.oficina.deleteMany({ where: { id: oficinaId } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  it("dois 'Concluir' ao mesmo tempo geram um único título a receber", async () => {
    const osId = await novaOs(await novaPeca(10), "em_andamento");

    const resultados = await Promise.allSettled([
      OrdensService.update(osId, { status: "concluida" }, oficinaId),
      OrdensService.update(osId, { status: "concluida" }, oficinaId),
      OrdensService.update(osId, { status: "concluida" }, oficinaId),
    ]);
    expect(resultados.every((r) => r.status === "fulfilled")).toBe(true);

    const titulos = await prisma.pagamento.count({ where: { ordem_servico_id: osId, tipo: "receber", deleted_at: null } });
    expect(titulos).toBe(1);
  });

  it("dois 'Cancelar' ao mesmo tempo devolvem o estoque uma vez só", async () => {
    const pecaId = await novaPeca(10);
    const osId = await novaOs(pecaId, "aberta");
    expect(await estoque(pecaId)).toBe(8);

    await Promise.allSettled([
      OrdensService.update(osId, { status: "cancelada" }, oficinaId),
      OrdensService.update(osId, { status: "cancelada" }, oficinaId),
      OrdensService.update(osId, { status: "cancelada" }, oficinaId),
    ]);
    expect(await estoque(pecaId)).toBe(10);
  });

  it("duas exclusões ao mesmo tempo devolvem o estoque uma vez só", async () => {
    const pecaId = await novaPeca(10);
    const osId = await novaOs(pecaId, "aberta");

    const resultados = await Promise.allSettled([
      OrdensService.delete(osId, oficinaId),
      OrdensService.delete(osId, oficinaId),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await estoque(pecaId)).toBe(10);
  });

  it("concluir e cancelar ao mesmo tempo: só uma das transições vale", async () => {
    const pecaId = await novaPeca(10);
    const osId = await novaOs(pecaId, "em_andamento");

    const resultados = await Promise.allSettled([
      OrdensService.update(osId, { status: "concluida" }, oficinaId),
      OrdensService.update(osId, { status: "cancelada" }, oficinaId),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const os = await prisma.ordem_servico.findUniqueOrThrow({ where: { id: osId } });
    const titulos = await prisma.pagamento.count({ where: { ordem_servico_id: osId, deleted_at: null } });
    if (os.status === "concluida") {
      expect(titulos).toBe(1);
      expect(await estoque(pecaId)).toBe(8);
    } else {
      expect(os.status).toBe("cancelada");
      expect(titulos).toBe(0);
      expect(await estoque(pecaId)).toBe(10);
    }
  });
});
