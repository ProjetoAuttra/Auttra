import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/prisma/client.js";
import { VeiculosService } from "../src/services/veiculos.service.js";

const suffix = Date.now();

// Auditoria V1, B3: a edicao do veiculo copiava o body inteiro para o Prisma.
describe.skipIf(!process.env.DATABASE_URL)("veículo: edição só altera campos permitidos", () => {
  let cidadeId: number;
  const oficinas: number[] = [];

  async function montarOficina(tag: string) {
    const oficinaId = (
      await prisma.oficina.create({
        data: { nome: `Oficina Vei ${tag} ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId },
      })
    ).id;
    oficinas.push(oficinaId);
    const clienteId = (await prisma.cliente.create({ data: { nome: `Cliente ${tag}`, oficina_id: oficinaId } })).id;
    const veiculoId = (
      await prisma.veiculo.create({
        data: { marca: "Fiat", modelo: "Uno", ano: 2010, placa: `VE${tag}${suffix % 10000}`, oficina_id: oficinaId, cliente_id: clienteId },
      })
    ).id;
    const funcionarioId = (
      await prisma.funcionario.create({
        data: { nome: `Mecanico ${tag}`, cargo: "mecanico", data_contratacao: new Date(), oficina_id: oficinaId },
      })
    ).id;
    const osId = (
      await prisma.ordem_servico.create({
        data: { oficina_id: oficinaId, cliente_id: clienteId, veiculo_id: veiculoId, funcionario_id: funcionarioId },
      })
    ).id;
    return { oficinaId, clienteId, veiculoId, osId };
  }

  let atacante: Awaited<ReturnType<typeof montarOficina>>;
  let vitima: Awaited<ReturnType<typeof montarOficina>>;

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Vei ${suffix}`, uf: "SP" } })).id;
    atacante = await montarOficina("A");
    vitima = await montarOficina("B");
  });

  afterAll(async () => {
    await prisma.ordem_servico.deleteMany({ where: { oficina_id: { in: oficinas } } });
    await prisma.funcionario.deleteMany({ where: { oficina_id: { in: oficinas } } });
    await prisma.veiculo.deleteMany({ where: { oficina_id: { in: oficinas } } });
    await prisma.cliente.deleteMany({ where: { oficina_id: { in: oficinas } } });
    await prisma.oficina.deleteMany({ where: { id: { in: oficinas } } });
    await prisma.cidade.delete({ where: { id: cidadeId } });
  });

  it("ignora relações aninhadas e campos internos enviados no body", async () => {
    await VeiculosService.update(
      atacante.veiculoId,
      {
        cor: "Prata",
        ordens: { connect: [{ id: vitima.osId }] },
        orcamentos: { create: [{}] },
        deleted_at: new Date(),
        oficina_id: vitima.oficinaId,
      },
      atacante.oficinaId
    );

    const osVitima = await prisma.ordem_servico.findUniqueOrThrow({ where: { id: vitima.osId } });
    expect(osVitima.veiculo_id).toBe(vitima.veiculoId);

    const v = await prisma.veiculo.findUniqueOrThrow({ where: { id: atacante.veiculoId } });
    expect(v.cor).toBe("Prata");
    expect(v.deleted_at).toBeNull();
    expect(v.oficina_id).toBe(atacante.oficinaId);
  });

  it("não aceita cliente de outra oficina", async () => {
    await expect(
      VeiculosService.update(atacante.veiculoId, { cliente_id: vitima.clienteId }, atacante.oficinaId)
    ).rejects.toThrow(/Cliente nao encontrado/);
  });

  it("aceita o formulário de edição, com campos numéricos vazios virando null", async () => {
    const v = await VeiculosService.update(
      atacante.veiculoId,
      {
        cliente_id: atacante.clienteId,
        marca: "Fiat",
        modelo: "Palio",
        ano: "",
        placa: "abc-1d23",
        cor: "",
        combustivel: "Flex",
        quilometragem: "",
        observacao: "revisado",
      },
      atacante.oficinaId
    );
    expect(v.modelo).toBe("Palio");
    expect(v.placa).toBe("ABC1D23");
    expect(v.ano).toBeNull();
    expect(v.quilometragem).toBeNull();
    expect(v.cor).toBeNull();
    expect(v.combustivel).toBe("Flex");
  });

  it("recusa marca vazia", async () => {
    await expect(VeiculosService.update(atacante.veiculoId, { marca: " " }, atacante.oficinaId)).rejects.toThrow(/marca/);
  });
});
