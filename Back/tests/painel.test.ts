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
// Vencimento é só a data, gravada como o formulário grava (meia-noite UTC do dia em São Paulo).
// Com hora, entre 21h e 0h de Brasília a data UTC já é o dia seguinte e o teste falhava.
const hojeSP = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const vencimento = (n: number) => new Date(Date.parse(`${hojeSP}T00:00:00Z`) + n * DIA);

describe.skipIf(!process.env.DATABASE_URL)("painel: resumo da tela de inicio", () => {
  let cidadeId: number;
  let oficinaId: number;
  let outraOficinaId: number;
  let usuarioId: number;
  let authTudo: string;
  let authSoAgenda: string;
  let authSemPainel: string;
  let authOutra: string;
  const get = (token: string) => request(app).get("/api/painel/resumo").set("Authorization", token);

  beforeAll(async () => {
    cidadeId = (await prisma.cidade.create({ data: { nome: `Cidade Painel ${suffix}`, uf: "SP" } })).id;
    const novaOficina = async (n: string) =>
      (await prisma.oficina.create({ data: { nome: `Oficina Painel ${n} ${suffix}`, logradouro: "Rua", numero: "1", cep: "00000000", cidade_id: cidadeId } })).id;
    oficinaId = await novaOficina("A");
    outraOficinaId = await novaOficina("B");
    usuarioId = await criarUsuarioComAcesso([oficinaId, outraOficinaId], "painel");

    const token = (oficina: number, permissoes: object) =>
      "Bearer " + jwt.sign({ id: usuarioId, email: "p@example.com", nome: "P", tipo: "gestoroficina", oficinaId: oficina, permissoes, tv: 0 }, getJwtSecret(), { expiresIn: "5m" });
    const todas = { painel: ["read"], financeiro: ["read"], ordens: ["read"], orcamentos: ["read"], estoque: ["read"], agenda: ["read"] };
    authTudo = token(oficinaId, todas);
    authSoAgenda = token(oficinaId, { painel: ["read"], agenda: ["read"] });
    authSemPainel = token(oficinaId, { clientes: ["read"] });
    authOutra = token(outraOficinaId, todas);

    const cliente = (await prisma.cliente.create({ data: { nome: "Cliente Painel", oficina_id: oficinaId } })).id;
    const veiculo = (await prisma.veiculo.create({ data: { marca: "Fiat", modelo: "Uno", placa: `PNL${suffix % 10000}`, oficina_id: oficinaId, cliente_id: cliente } })).id;
    const mec = (await prisma.funcionario.create({ data: { nome: "Mecanico P", cargo: "mecanico", data_contratacao: new Date(), oficina_id: oficinaId } })).id;

    const os = (status: any, abertaHa: number, valor = 0, fechamento: Date | null = null) =>
      prisma.ordem_servico.create({
        data: { oficina_id: oficinaId, cliente_id: cliente, veiculo_id: veiculo, funcionario_id: mec, status, valor_total: valor, data_abertura: diasAtras(abertaHa), data_fechamento: fechamento },
      });
    await os("em_andamento", 9); // parada (a mais antiga)
    await os("aberta", 6); // parada
    await os("aberta", 2); // recente
    await os("concluida", 1, 700, new Date()); // faturamento de hoje

    const pagamento = (tipo: "receber" | "pagar", venc: Date, valor: number, extra: Record<string, unknown> = {}) =>
      prisma.pagamento.create({
        data: { oficina_id: oficinaId, cliente_id: tipo === "receber" ? cliente : null, tipo, valor, valor_original: valor, status: "pendente", data_vencimento: venc, ...extra } as any,
      });
    await pagamento("receber", vencimento(0), 300); // vence hoje
    await pagamento("receber", vencimento(-4), 200, { desconto: 50 }); // vencida: saldo 150
    await pagamento("receber", vencimento(-4), 999, { status: "pago", valor_pago: 999 }); // pago: fica de fora
    await pagamento("pagar", vencimento(1), 120); // vence amanha
    await pagamento("pagar", vencimento(20), 500); // fora da semana

    await prisma.orcamento.create({ data: { descricao: "Antigo", valor: 100, data: new Date(), status: "analise", cliente_id: cliente, veiculo_id: veiculo, created_at: diasAtras(5) } });
    await prisma.orcamento.create({ data: { descricao: "Recente", valor: 100, data: new Date(), status: "analise", cliente_id: cliente, veiculo_id: veiculo } });
    await prisma.orcamento.create({ data: { descricao: "Aprovado", valor: 100, data: new Date(), status: "aprovado", cliente_id: cliente, veiculo_id: veiculo, created_at: diasAtras(5) } });

    await prisma.peca.create({ data: { oficina_id: oficinaId, nome: `Baixa ${suffix}`, preco_custo: 1, preco_venda: 2, estoque: 3 } });
    await prisma.peca.create({ data: { oficina_id: oficinaId, nome: `Ok ${suffix}`, preco_custo: 1, preco_venda: 2, estoque: 4 } });

    const agenda = (titulo: string, inicio: Date, status: any = "confirmado") =>
      prisma.agendamento.create({ data: { oficina_id: oficinaId, cliente_id: cliente, veiculo_id: veiculo, titulo, data_inicio: inicio, data_fim: new Date(inicio.getTime() + 3600_000), status } });
    const hojeAoMeioDia = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })}T12:00:00-03:00`);
    await agenda("Revisao", hojeAoMeioDia);
    await agenda("Cancelado", hojeAoMeioDia, "cancelado");
    await agenda("Amanha", new Date(hojeAoMeioDia.getTime() + DIA));
  });

  afterAll(async () => {
    await prisma.agendamento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.orcamento.deleteMany({ where: { cliente: { oficina_id: oficinaId } } });
    await prisma.pagamento.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.ordem_servico.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.peca.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.funcionario.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.veiculo.deleteMany({ where: { oficina_id: oficinaId } });
    await prisma.cliente.deleteMany({ where: { oficina_id: oficinaId } });
    await removerUsuario(usuarioId);
    await prisma.oficina.deleteMany({ where: { id: { in: [oficinaId, outraOficinaId] } } });
    await prisma.cidade.deleteMany({ where: { id: cidadeId } });
  });

  it("exige o modulo painel", async () => {
    expect((await get(authSemPainel)).status).toBe(403);
  });

  it("financeiro: faturamento do mes, serie dos ultimos 8 dias e contas (saldo considera desconto; pago fica de fora)", async () => {
    const r = await get(authTudo);
    expect(r.status).toBe(200);
    expect(r.body.financeiro).toMatchObject({
      a_receber_hoje: 300,
      a_receber_vencido: 150,
      a_pagar_semana: 120,
      contas_pagar_amanha: 1,
    });
    expect(r.body.financeiro.dias).toHaveLength(8);
    expect(r.body.financeiro.dias.at(-1)).toMatchObject({ total: 700 });
    expect(r.body.financeiro.faturamento_mes).toBeGreaterThanOrEqual(700);
  });

  it("atencao: OS paradas, contas vencidas, orcamentos sem resposta, estoque critico e contas a pagar de amanha", async () => {
    const r = await get(authTudo);
    expect(r.body.atencao).toEqual([
      { chave: "ordens_paradas", quantidade: 2, dias: 9 },
      { chave: "contas_vencidas", quantidade: 1, valor: 150 },
      { chave: "orcamentos_sem_resposta", quantidade: 1 },
      { chave: "estoque_critico", quantidade: 1 },
      { chave: "contas_pagar_amanha", quantidade: 1, valor: 120 },
    ]);
  });

  it("agenda: so os agendamentos de hoje, sem cancelados", async () => {
    const r = await get(authTudo);
    expect(r.body.agenda.total).toBe(1);
    expect(r.body.agenda.itens).toHaveLength(1);
    expect(r.body.agenda.itens[0]).toMatchObject({ titulo: "Revisao", cliente: "Cliente Painel", veiculo: "Fiat Uno", status: "confirmado" });
  });

  it("so entrega os blocos dos modulos que o usuario pode ler", async () => {
    const r = await get(authSoAgenda);
    expect(r.status).toBe(200);
    expect(r.body.financeiro).toBeNull();
    expect(r.body.atencao).toEqual([]);
    expect(r.body.agenda.total).toBe(1);
  });

  it("nao mistura dados de outra oficina", async () => {
    const r = await get(authOutra);
    expect(r.status).toBe(200);
    expect(r.body.atencao).toEqual([]);
    expect(r.body.agenda).toMatchObject({ total: 0, itens: [] });
    expect(r.body.financeiro).toMatchObject({ faturamento_mes: 0, a_receber_hoje: 0, a_pagar_semana: 0 });
  });
});
