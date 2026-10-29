import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { getJwtSecret } from "../src/config/env.js";
import { prisma } from "../src/prisma/client.js";
import { criarUsuarioComAcesso, removerUsuario } from "./sessao.js";

const suffix = Date.now();
const DIA = 24 * 60 * 60 * 1000;
const diasAtras = (n: number) => new Date(Date.now() - n * DIA);
const em = (iso: string) => new Date(`${iso}T12:00:00-03:00`);

describe.skipIf(!process.env.DATABASE_URL)("relatorios agregados", () => {
  let cidadeId: number;
  let oficinaId: number;
  let outraOficinaId: number;
  let usuarioId: number;
  let auth: string;
  let authSemPermissao: string;
  let authOutra: string;
  let mecAId: number;
  let mecBId: number;
  let cliUmId: number;
  let cliDoisId: number;
  const get = (url: string, token = auth) => request(app).get(url).set("Authorization", token);

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Rel ${suffix}`, uf: "SP" } })).id;
    const novaOficina = async (n: string) =>
      (await prisma.oficina.create({ data: { nome: `Oficina Rel ${n} ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId } })).id;
    oficinaId = await novaOficina("A");
    outraOficinaId = await novaOficina("B");
    usuarioId = await criarUsuarioComAcesso([oficinaId, outraOficinaId], "rel");

    const token = (oficina: number, permissoes: object) =>
      "Bearer " + jwt.sign({ id: usuarioId, email: "r@example.com", nome: "R", tipo: "gestoroficina", oficinaId: oficina, permissoes, tv: 0 }, getJwtSecret(), { expiresIn: "5m" });
    auth = token(oficinaId, { relatorios: ["read"] });
    authSemPermissao = token(oficinaId, { clientes: ["read"] });
    authOutra = token(outraOficinaId, { relatorios: ["read"] });

    const c1 = (await prisma.cliente.create({ data: { nome: "Cliente Um", oficina_id: oficinaId } })).id;
    const c2 = (await prisma.cliente.create({ data: { nome: "Cliente Dois", oficina_id: oficinaId } })).id;
    const veiculo = (await prisma.veiculo.create({ data: { marca: "Fiat", modelo: "Uno", placa: `REL${suffix % 10000}`, oficina_id: oficinaId, cliente_id: c1 } })).id;
    const mecA = (await prisma.funcionario.create({ data: { nome: "Mecanico A", cargo: "mecanico", data_contratacao: new Date(), oficina_id: oficinaId } })).id;
    const mecB = (await prisma.funcionario.create({ data: { nome: "Mecanico B", cargo: "mecanico", data_contratacao: new Date(), oficina_id: oficinaId } })).id;
    [mecAId, mecBId, cliUmId, cliDoisId] = [mecA, mecB, c1, c2];
    const servico = (await prisma.servico.create({ data: { oficina_id: oficinaId, nome: `Servico ${suffix}`, preco: 100 } })).id;
    const peca = (await prisma.peca.create({ data: { oficina_id: oficinaId, nome: `Peca ${suffix}`, preco_custo: 60, preco_venda: 100, estoque: 50 } })).id;

    const os = async (valor: number, funcionario_id: number, cliente_id: number, status: any, fechamento: string | null, itens: any[]) => {
      const o = await prisma.ordem_servico.create({
        data: { oficina_id: oficinaId, cliente_id, veiculo_id: veiculo, funcionario_id, status, valor_total: valor, data_fechamento: fechamento ? em(fechamento) : null },
      });
      for (const i of itens) await prisma.item_ordem_servico.create({ data: { ordem_servico_id: o.id, ...i } });
      return o.id;
    };
    await os(500, mecA, c1, "concluida", "2026-03-10", [
      { tipo_item: "servico", servico_id: servico, quantidade: 1, preco_unitario: 300, subtotal: 300 },
      { tipo_item: "peca", peca_id: peca, quantidade: 2, preco_unitario: 100, subtotal: 200 },
    ]);
    await os(300, mecB, c2, "concluida", "2026-03-20", [{ tipo_item: "servico", servico_id: servico, quantidade: 3, preco_unitario: 100, subtotal: 300 }]);
    await os(200, mecA, c1, "concluida", "2026-02-10", [{ tipo_item: "servico", servico_id: servico, quantidade: 2, preco_unitario: 100, subtotal: 200 }]);
    await os(900, mecA, c1, "em_andamento", null, []);

    // contas a receber vencidas (o calculo depende de "hoje", entao as datas sao relativas)
    const receber = (cliente_id: number, venc: Date, extra: Record<string, unknown> = {}) =>
      prisma.pagamento.create({
        data: { oficina_id: oficinaId, cliente_id, tipo: "receber", valor: 100, valor_original: 100, status: "pendente", data_vencimento: venc, ...extra } as any,
      });
    await receber(c1, diasAtras(10));
    await receber(c1, diasAtras(45), { valor: 200, valor_original: 200, desconto: 20 });
    await receber(c2, diasAtras(100), { valor: 300, valor_original: 300 });
    await receber(c2, new Date(Date.now() + 20 * DIA), { valor: 400, valor_original: 400 });
    await receber(c2, diasAtras(5), { valor: 500, valor_original: 500, status: "pago", valor_pago: 500 });

    // movimentos para o resultado (regime de caixa)
    const titulo = async (tipo: "receber" | "pagar", categoria: string) =>
      (await prisma.pagamento.create({ data: { oficina_id: oficinaId, tipo, categoria, valor: 1, valor_original: 1, status: "pago", data_vencimento: new Date() } as any })).id;
    const mov = (pagamento_id: number, tipo: "pagamento" | "estorno", valor: number, data: string) =>
      prisma.pagamento_movimento.create({ data: { pagamento_id, oficina_id: oficinaId, tipo, valor, created_at: em(data) } });
    const recServ = await titulo("receber", "Servicos");
    await mov(recServ, "pagamento", 800, "2026-03-12");
    await mov(recServ, "estorno", 100, "2026-03-15");
    await mov(recServ, "pagamento", 200, "2026-02-10");
    await mov(await titulo("pagar", "Aluguel"), "pagamento", 300, "2026-03-05");
    await mov(await titulo("pagar", "Pecas"), "pagamento", 100, "2026-03-08");
  });

  afterAll(async () => {
    await prisma.pagamento_movimento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.pagamento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.item_ordem_servico.deleteMany({ where: { ordem_servico: { oficina_id: oficinaId } } });
    await prisma.ordem_servico.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.servico.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.peca.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.funcionario.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.veiculo.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.cliente.deleteMany({ where: { oficina_id: oficinaId } });
    await removerUsuario(usuarioId);
    await prisma.oficina.deleteMany({ where: { id: { in: [oficinaId, outraOficinaId] } } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  it("inadimplencia: faixas de atraso, total e clientes (saldo considera desconto; a vencer e pago ficam de fora)", async () => {
    const r = await get("/api/relatorios/inadimplencia");
    expect(r.status).toBe(200);
    expect(r.body.faixas).toEqual([
      { faixa: "1-30", quantidade: 1, valor: 100 },
      { faixa: "31-60", quantidade: 1, valor: 180 },
      { faixa: "61-90", quantidade: 0, valor: 0 },
      { faixa: "90+", quantidade: 1, valor: 300 },
    ]);
    expect(r.body).toMatchObject({ total_vencido: 580, titulos_vencidos: 3, clientes_inadimplentes: 2, total_a_receber: 980 });
    expect(r.body.percentual_carteira).toBeCloseTo(59.18, 2);
    expect(r.body.clientes.map((c: any) => [c.nome, c.titulos, c.valor])).toEqual([
      ["Cliente Dois", 1, 300],
      ["Cliente Um", 2, 280],
    ]);
    expect(r.body.clientes[0].dias_atraso).toBeGreaterThanOrEqual(99);
  });

  it("faturamento: OS concluidas no periodo, comparativo com o periodo anterior, composicao e top clientes", async () => {
    const r = await get("/api/relatorios/faturamento?from=2026-03-01&to=2026-03-31");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      total: 800,
      ordens_concluidas: 2,
      ticket_medio: 400,
      periodo_anterior: { total: 200, ordens_concluidas: 1 },
      variacao_percentual: 300,
      composicao: { servicos: 600, pecas: 200 },
    });
    expect(r.body.semanas.reduce((s: number, x: any) => s + x.total, 0)).toBe(800);
    expect(r.body.clientes.map((c: any) => [c.nome, c.total])).toEqual([["Cliente Um", 500], ["Cliente Dois", 300]]);
  });

  it("faturamento filtra por mecanico e por cliente (varios ids)", async () => {
    const q = "from=2026-03-01&to=2026-03-31";
    const porMec = await get(`/api/relatorios/faturamento?${q}&mecanico_id=${mecAId}`);
    expect(porMec.body).toMatchObject({ total: 500, ordens_concluidas: 1, periodo_anterior: { total: 200 }, composicao: { servicos: 300, pecas: 200 } });
    const porCli = await get(`/api/relatorios/faturamento?${q}&cliente_id=${cliDoisId}`);
    expect(porCli.body).toMatchObject({ total: 300, ordens_concluidas: 1, periodo_anterior: { total: 0 } });
    expect(porCli.body.clientes.map((c: any) => c.nome)).toEqual(["Cliente Dois"]);
    const ambos = await get(`/api/relatorios/faturamento?${q}&mecanico_id=${mecAId},${mecBId}&cliente_id=${cliUmId}`);
    expect(ambos.body.total).toBe(500);
    expect((await get(`/api/relatorios/faturamento?${q}&mecanico_id=abc,-1`)).body.total).toBe(800);
  });

  it("inadimplencia filtra por cliente", async () => {
    const r = await get(`/api/relatorios/inadimplencia?cliente_id=${cliDoisId}`);
    expect(r.body.clientes.map((c: any) => c.nome)).toEqual(["Cliente Dois"]);
    expect(r.body.total_vencido).toBe(300);
    expect(r.body.total_a_receber).toBeGreaterThanOrEqual(300); // inclui o que ainda vai vencer, só deste cliente
    const todos = await get("/api/relatorios/inadimplencia");
    expect(r.body.total_a_receber).toBeLessThan(todos.body.total_a_receber);
  });

  it("faturamento sem periodo anterior com dados nao inventa variacao", async () => {
    const r = await get("/api/relatorios/faturamento?from=2026-02-01&to=2026-02-28");
    expect(r.body.total).toBe(200);
    expect(r.body.variacao_percentual).toBeNull();
  });

  it("mecanicos: concluidas, faturamento, ticket, custo de pecas, margem e abertas", async () => {
    const r = await get("/api/relatorios/mecanicos?from=2026-03-01&to=2026-03-31");
    expect(r.status).toBe(200);
    expect(r.body.totais).toEqual({ ordens_concluidas: 2, faturamento: 800, ticket_medio: 400 });
    const a = r.body.mecanicos.find((m: any) => m.nome === "Mecanico A");
    const b = r.body.mecanicos.find((m: any) => m.nome === "Mecanico B");
    expect(a).toMatchObject({ ordens_concluidas: 1, ordens_abertas: 1, faturamento: 500, ticket_medio: 500, custo_pecas: 120, margem: 380, margem_percentual: 76 });
    expect(b).toMatchObject({ ordens_concluidas: 1, ordens_abertas: 0, faturamento: 300, custo_pecas: 0, margem: 300, margem_percentual: 100 });
    expect(r.body.mecanicos[0].nome).toBe("Mecanico A"); // ordenado por faturamento
  });

  it("resultado: regime de caixa pelos movimentos (estorno desconta), despesas por categoria e comparativo", async () => {
    const r = await get("/api/relatorios/resultado?from=2026-03-01&to=2026-03-31");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      receitas: 700,
      despesas: 400,
      resultado: 300,
      periodo_anterior: { receitas: 200, despesas: 0, resultado: 200 },
      variacao_resultado: 50,
    });
    expect(r.body.margem_percentual).toBeCloseTo(42.86, 2);
    expect(r.body.despesas_por_categoria).toEqual([{ categoria: "Aluguel", valor: 300 }, { categoria: "Pecas", valor: 100 }]);
    expect(r.body.receitas_por_categoria).toEqual([{ categoria: "Servicos", valor: 700 }]);
  });

  it("concluir uma OS grava a data de fechamento (base do faturamento)", async () => {
    const o = await prisma.ordem_servico.findFirstOrThrow({ where: { oficina_id: oficinaId, status: "em_andamento" } });
    const tokenOrdens =
      "Bearer " + jwt.sign({ id: usuarioId, email: "r@example.com", nome: "R", tipo: "gestoroficina", oficinaId, permissoes: { ordens: ["read", "update"] }, tv: 0 }, getJwtSecret(), { expiresIn: "5m" });
    expect(o.data_fechamento).toBeNull();

    const res = await request(app).put(`/api/ordens/${o.id}`).set("Authorization", tokenOrdens).send({ status: "concluida" });
    expect(res.status).toBe(200);
    const depois = await prisma.ordem_servico.findUniqueOrThrow({ where: { id: o.id } });
    expect(depois.data_fechamento).not.toBeNull();
    expect(Date.now() - depois.data_fechamento!.getTime()).toBeLessThan(60_000);
  });

  it("valida o periodo", async () => {
    for (const q of ["from=2026-3-1&to=2026-03-31", "from=2026-03-31&to=2026-03-01", "from=2024-01-01&to=2026-03-31", "from=abc"]) {
      expect((await get(`/api/relatorios/faturamento?${q}`)).status).toBe(400);
    }
  });

  it("exige permissao de relatorios e isola por oficina", async () => {
    for (const rota of ["inadimplencia", "faturamento", "mecanicos", "resultado"]) {
      expect((await get(`/api/relatorios/${rota}`, authSemPermissao)).status).toBe(403);
    }
    const outra = await get("/api/relatorios/faturamento?from=2026-03-01&to=2026-03-31", authOutra);
    expect(outra.body).toMatchObject({ total: 0, ordens_concluidas: 0 });
    expect((await get("/api/relatorios/inadimplencia", authOutra)).body.total_vencido).toBe(0);
  });
});
