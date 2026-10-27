import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";

const suffix = Date.now();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe.skipIf(!process.env.DATABASE_URL)("links publicos (UUID, status e soft delete)", () => {
  let cidadeId: number;
  let oficinaId: number;
  let outraOficinaId: number;
  let clienteId: number;
  let veiculoId: number;
  let funcionarioId: number;
  let osId: number;
  let orcamentoId: number;
  let token: string;
  let tokenOutraOficina: string;

  const tokenDe = (oficina: number) =>
    jwt.sign(
      {
        id: 1,
        email: "gestor@example.com",
        nome: "Gestor",
        tipo: "gestoroficina",
        oficinaId: oficina,
        permissoes: { ordens: ["read", "create", "update", "delete"], orcamentos: ["read", "create", "update", "delete"] },
      },
      getJwtSecret(),
      { expiresIn: "5m" }
    );

  beforeAll(async () => {
    const cidade = await prisma.cidade.create({ data: { nome: `Cidade Link ${suffix}`, uf: "SP" } });
    cidadeId = cidade.id;
    const novaOficina = (n: string) =>
      prisma.oficina.create({
        data: { nome: `Oficina Link ${n} ${suffix}`, logradouro: "Rua Teste", numero: "1", cep: "00000000", cidade_id: cidadeId },
      });
    oficinaId = (await novaOficina("A")).id;
    outraOficinaId = (await novaOficina("B")).id;

    clienteId = (await prisma.cliente.create({ data: { nome: "Cliente Link", oficina_id: oficinaId } })).id;
    veiculoId = (
      await prisma.veiculo.create({ data: { marca: "Fiat", modelo: "Uno", placa: `LNK${suffix % 10000}`, oficina_id: oficinaId, cliente_id: clienteId } })
    ).id;
    funcionarioId = (
      await prisma.funcionario.create({ data: { nome: "Mecanico", cargo: "mecanico", data_contratacao: new Date(), oficina_id: oficinaId } })
    ).id;
    osId = (
      await prisma.ordem_servico.create({
        data: { oficina_id: oficinaId, cliente_id: clienteId, veiculo_id: veiculoId, funcionario_id: funcionarioId },
      })
    ).id;
    orcamentoId = (
      await prisma.orcamento.create({
        data: { descricao: "Teste", valor: 100, data: new Date(), cliente_id: clienteId, veiculo_id: veiculoId },
      })
    ).id;

    token = tokenDe(oficinaId);
    tokenOutraOficina = tokenDe(outraOficinaId);
  });

  afterAll(async () => {
    await prisma.link_publico.deleteMany({ where: { oficina_id: { in: [oficinaId, outraOficinaId] } } });
    await prisma.orcamento.deleteMany({ where: { id: orcamentoId } });
    await prisma.ordem_servico.deleteMany({ where: { id: osId } });
    await prisma.funcionario.deleteMany({ where: { id: funcionarioId } });
    await prisma.veiculo.deleteMany({ where: { id: veiculoId } });
    await prisma.cliente.deleteMany({ where: { id: clienteId } });
    await prisma.oficina.deleteMany({ where: { id: { in: [oficinaId, outraOficinaId] } } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  it("gera um UUID e reaproveita o mesmo link ativo do documento", async () => {
    const a = await request(app).post(`/api/ordens/${osId}/share`).set("Authorization", `Bearer ${token}`);
    const b = await request(app).post(`/api/ordens/${osId}/share`).set("Authorization", `Bearer ${token}`);

    expect(a.status).toBe(200);
    expect(a.body.code).toMatch(UUID_RE);
    expect(b.body.code).toBe(a.body.code);
  });

  it("serve o acompanhamento publico sem login", async () => {
    const { body } = await request(app).post(`/api/orcamentos/${orcamentoId}/share`).set("Authorization", `Bearer ${token}`);
    const response = await request(app).get(`/api/public/acompanhamento/${body.code}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ type: "orcamento", id: orcamentoId });
  });

  it("nao compartilha documento de outra oficina", async () => {
    const response = await request(app).post(`/api/ordens/${osId}/share`).set("Authorization", `Bearer ${tokenOutraOficina}`);

    expect(response.status).toBe(400);
  });

  it("cancelar faz soft delete e o link deixa de funcionar", async () => {
    const { body } = await request(app).post(`/api/ordens/${osId}/share`).set("Authorization", `Bearer ${token}`);

    const cancel = await request(app).delete(`/api/ordens/${osId}/share`).set("Authorization", `Bearer ${token}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body).toEqual({ canceled: 1 });

    const row = await prisma.link_publico.findUnique({ where: { id: body.code } });
    expect(row?.status).toBe("cancelado");
    expect(row?.deleted_at).not.toBeNull();

    expect((await request(app).get(`/api/public/acompanhamento/${body.code}`)).status).toBe(404);
    expect((await request(app).get(`/api/s/${body.code}`)).status).toBe(404);
    expect((await request(app).get(`/api/s/${body.code}/pdf`)).status).toBe(404);
  });

  it("compartilhar de novo depois de cancelar gera um codigo novo", async () => {
    const antigo = (await prisma.link_publico.findFirst({ where: { ordem_servico_id: osId, status: "cancelado" } }))!.id;
    const { body } = await request(app).post(`/api/ordens/${osId}/share`).set("Authorization", `Bearer ${token}`);

    expect(body.code).toMatch(UUID_RE);
    expect(body.code).not.toBe(antigo);
  });

  it("codigo que nao eh UUID retorna 404 sem consultar o banco com lixo", async () => {
    expect((await request(app).get("/api/public/acompanhamento/ABC123")).status).toBe(404);
  });
});
