import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/prisma/client.js";
import { OrdensService } from "../src/services/ordens.service.js";

const suffix = Date.now();

// Auditoria V1, B2: a edicao da OS espalhava o body inteiro no Prisma.
describe.skipIf(!process.env.DATABASE_URL)("OS: edição só altera campos permitidos", () => {
  let cidadeId: number;
  const oficinas: number[] = [];

  async function montarOficina(tag: string) {
    const oficinaId = (
      await prisma.oficina.create({
        data: { nome: `Oficina Ed ${tag} ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId },
      })
    ).id;
    oficinas.push(oficinaId);
    const clienteId = (await prisma.cliente.create({ data: { nome: `Cliente ${tag}`, oficina_id: oficinaId } })).id;
    const veiculoId = (
      await prisma.veiculo.create({
        data: { marca: "Fiat", modelo: "Uno", placa: `ED${tag}${suffix % 10000}`, oficina_id: oficinaId, cliente_id: clienteId },
      })
    ).id;
    const funcionarioId = (
      await prisma.funcionario.create({
        data: { nome: `Mecanico ${tag}`, cargo: "mecanico", data_contratacao: new Date(), oficina_id: oficinaId },
      })
    ).id;
    const os = await prisma.ordem_servico.create({
      data: { oficina_id: oficinaId, cliente_id: clienteId, veiculo_id: veiculoId, funcionario_id: funcionarioId, valor_total: 100 },
    });
    return { oficinaId, clienteId, veiculoId, funcionarioId, osId: os.id };
  }

  let atacante: Awaited<ReturnType<typeof montarOficina>>;
  let vitima: Awaited<ReturnType<typeof montarOficina>>;
  let tituloVitimaId: number;

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Ed ${suffix}`, uf: "SP" } })).id;
    atacante = await montarOficina("A");
    vitima = await montarOficina("B");
    tituloVitimaId = (
      await prisma.pagamento.create({
        data: {
          tipo: "receber", oficina_id: vitima.oficinaId, cliente_id: vitima.clienteId, ordem_servico_id: vitima.osId,
          valor: 100, valor_original: 100, status: "pendente", data_vencimento: new Date(),
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.pagamento.deleteMany({ where: { oficina_id: { in: oficinas } } });
    await prisma.item_ordem_servico.deleteMany({ where: { ordem_servico: { oficina_id: { in: oficinas } } } });
    await prisma.ordem_servico.deleteMany({ where: { oficina_id: { in: oficinas } } });
    await prisma.funcionario.deleteMany({ where: { oficina_id: { in: oficinas } } });
    await prisma.veiculo.deleteMany({ where: { oficina_id: { in: oficinas } } });
    await prisma.cliente.deleteMany({ where: { oficina_id: { in: oficinas } } });
    await prisma.oficina.deleteMany({ where: { id: { in: oficinas } } });
    await prisma.cidade.delete({ where: { id: cidadeId } });
  });

  it("ignora relações aninhadas e campos internos enviados no body", async () => {
    const antes = await prisma.ordem_servico.findUniqueOrThrow({ where: { id: atacante.osId } });

    await OrdensService.update(
      atacante.osId,
      {
        observacoes: "editada",
        pagamentos: { connect: [{ id: tituloVitimaId }] },
        agendamentos: { create: [{ titulo: "x" }] },
        deleted_at: new Date(),
        data_abertura: "2000-01-01T00:00:00Z",
        orcamento_id: 999999,
        valor_total: 1,
        oficina_id: vitima.oficinaId,
      },
      atacante.oficinaId
    );

    const titulo = await prisma.pagamento.findUniqueOrThrow({ where: { id: tituloVitimaId } });
    expect(titulo.ordem_servico_id).toBe(vitima.osId);

    const depois = await prisma.ordem_servico.findUniqueOrThrow({ where: { id: atacante.osId } });
    expect(depois.observacoes).toBe("editada");
    expect(depois.deleted_at).toBeNull();
    expect(depois.oficina_id).toBe(atacante.oficinaId);
    expect(depois.orcamento_id).toBeNull();
    expect(depois.data_abertura.toISOString()).toBe(antes.data_abertura.toISOString());
    expect(Number(depois.valor_total)).toBe(100);
  });

  it("não aceita cliente de outra oficina", async () => {
    await expect(
      OrdensService.update(atacante.osId, { cliente_id: vitima.clienteId }, atacante.oficinaId)
    ).rejects.toThrow(/Cliente nao encontrado/);
  });

  it("recusa status desconhecido", async () => {
    await expect(OrdensService.update(atacante.osId, { status: "paga" }, atacante.oficinaId)).rejects.toThrow(/Status de OS inválido/);
  });

  it("aceita o payload que o formulário de edição envia", async () => {
    const r: any = await OrdensService.update(
      atacante.osId,
      {
        oficina_id: atacante.oficinaId,
        cliente_id: atacante.clienteId,
        veiculo_id: atacante.veiculoId,
        funcionario_id: atacante.funcionarioId,
        observacoes: "via formulário",
        valor_total: 80,
        itens: [{ tipo_item: "servico", nome: "Revisão", servico_id: null, peca_id: null, quantidade: 1, preco_unitario: 80, subtotal: 80 }],
      },
      atacante.oficinaId
    );
    expect(r.observacoes).toBe("via formulário");
    expect(Number(r.valor_total)).toBe(80);
    expect(r.itens).toHaveLength(1);
  });
});
