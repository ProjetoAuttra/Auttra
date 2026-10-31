// Seed para debug local: cria uma oficina com gestor e alguns dados de exemplo.
// Uso: npm run seed:dev  (login: lucas@teste.com / senha123)
import "dotenv/config";
import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_ACCESS_PROFILES } from "../src/permissions/accessProfiles.js";

const prisma = new PrismaClient();

const EMAIL = "lucas@teste.com";
const SENHA = "senha123";
const OFICINA_NOME = "Oficina Dev";

function dias(offset: number, hora = 9) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hora, 0, 0, 0);
  return d;
}

async function criarOficinaEGestor() {
  const cidade =
    (await prisma.cidade.findFirst({ where: { nome: "São Paulo", uf: "SP" } })) ??
    (await prisma.cidade.create({ data: { nome: "São Paulo", uf: "SP" } }));

  const oficina = await prisma.oficina.upsert({
    where: { nome: OFICINA_NOME },
    update: { deleted_at: null },
    create: {
      nome: OFICINA_NOME,
      razao_social: "Oficina Dev LTDA",
      logradouro: "Rua das Oficinas",
      numero: "100",
      bairro: "Centro",
      cep: "01001000",
      cidade_id: cidade.id,
      telefone: "11999990000",
    },
  });

  for (const perfil of DEFAULT_ACCESS_PROFILES) {
    await prisma.perfil_acesso.upsert({
      where: { oficina_id_nome: { oficina_id: oficina.id, nome: perfil.nome } },
      update: { deleted_at: null },
      create: {
        oficina_id: oficina.id,
        nome: perfil.nome,
        descricao: perfil.descricao,
        chave: perfil.chave,
        padrao: perfil.padrao,
        sistema: true,
        permissoes: perfil.permissoes as Prisma.InputJsonValue,
      },
    });
  }
  const proprietario = await prisma.perfil_acesso.findFirstOrThrow({
    where: { oficina_id: oficina.id, chave: "proprietario", deleted_at: null },
  });

  const senhaHash = await bcrypt.hash(SENHA, 10);
  const usuario = await prisma.usuario.upsert({
    where: { email: EMAIL },
    update: {
      senha: senhaHash,
      tipo: "gestoroficina",
      status: "ativo",
      deleted_at: null,
      failed_login_attempts: 0,
      locked_until: null,
    },
    create: { nome: "Lucas", email: EMAIL, senha: senhaHash, tipo: "gestoroficina", status: "ativo" },
  });

  await prisma.usuario_oficina.upsert({
    where: { usuario_id_oficina_id: { usuario_id: usuario.id, oficina_id: oficina.id } },
    update: { perfil: "gestoroficina", perfil_acesso_id: proprietario.id, status: "ativo", deleted_at: null },
    create: {
      usuario_id: usuario.id,
      oficina_id: oficina.id,
      perfil: "gestoroficina",
      perfil_acesso_id: proprietario.id,
      status: "ativo",
    },
  });

  await prisma.oficina.update({ where: { id: oficina.id }, data: { gestor_usuario_id: usuario.id } });

  return { oficina, usuario, cidade };
}

async function criarDadosExemplo(oficinaId: number, usuarioId: number, cidadeId: number) {
  const mecanico = await prisma.funcionario.create({
    data: { oficina_id: oficinaId, nome: "Carlos Mecânico", cargo: "mecanico", data_contratacao: dias(-400), telefone: "11988880001" },
  });
  await prisma.funcionario.create({
    data: { oficina_id: oficinaId, nome: "Ana Atendente", cargo: "atendente", data_contratacao: dias(-200), telefone: "11988880002" },
  });

  const servicos = await Promise.all(
    [
      { nome: "Troca de óleo", preco: 120, categoria: "Manutenção", tempo_estimado: 30 },
      { nome: "Alinhamento e balanceamento", preco: 150, categoria: "Suspensão", tempo_estimado: 60 },
      { nome: "Revisão completa", preco: 450, categoria: "Manutenção", tempo_estimado: 180 },
      { nome: "Troca de pastilhas de freio", preco: 180, categoria: "Freios", tempo_estimado: 60 },
      { nome: "Diagnóstico eletrônico", preco: 100, categoria: "Elétrica", tempo_estimado: 45 },
    ].map((s) => prisma.servico.create({ data: { oficina_id: oficinaId, ...s } }))
  );

  const pecas = await Promise.all(
    [
      { nome: "Óleo 5W30 1L", preco_custo: 25, preco_venda: 45, estoque: 40 },
      { nome: "Filtro de óleo", preco_custo: 18, preco_venda: 35, estoque: 15 },
      { nome: "Pastilha de freio dianteira", preco_custo: 80, preco_venda: 150, estoque: 6 },
      { nome: "Filtro de ar", preco_custo: 22, preco_venda: 40, estoque: 2 },
      { nome: "Vela de ignição", preco_custo: 15, preco_venda: 30, estoque: 24 },
    ].map((p) => prisma.peca.create({ data: { oficina_id: oficinaId, ...p } }))
  );

  const fornecedor = await prisma.fornecedor.create({
    data: { oficina_id: oficinaId, nome: "Auto Peças Central", contato: "João", telefone: "1133330000", email: "vendas@autopecas.teste", cidade_id: cidadeId },
  });
  await prisma.fornecedor.create({
    data: { oficina_id: oficinaId, nome: "Distribuidora Lubrificantes", telefone: "1133331111", cidade_id: cidadeId },
  });

  const dadosClientes = [
    { nome: "Maria Silva", cpf: "11111111111", telefone: "11977770001", veiculo: { marca: "Volkswagen", modelo: "Gol", ano: 2018, placa: "ABC1D23", cor: "Prata" } },
    { nome: "João Souza", cpf: "22222222222", telefone: "11977770002", veiculo: { marca: "Fiat", modelo: "Argo", ano: 2021, placa: "DEF4G56", cor: "Branco" } },
    { nome: "Pedro Santos", cpf: "33333333333", telefone: "11977770003", veiculo: { marca: "Chevrolet", modelo: "Onix", ano: 2020, placa: "GHI7J89", cor: "Preto" } },
    { nome: "Juliana Costa", cpf: "44444444444", telefone: "11977770004", veiculo: { marca: "Toyota", modelo: "Corolla", ano: 2019, placa: "JKL0M12", cor: "Cinza" } },
    { nome: "Rafael Lima", cpf: "55555555555", telefone: "11977770005", veiculo: { marca: "Honda", modelo: "Civic", ano: 2017, placa: "MNO3P45", cor: "Azul" } },
  ];

  const clientes = [];
  for (const { veiculo, ...c } of dadosClientes) {
    const cliente = await prisma.cliente.create({
      data: { oficina_id: oficinaId, ...c, email: `${c.nome.split(" ")[0].toLowerCase()}@cliente.teste`, cidade_id: cidadeId },
    });
    const v = await prisma.veiculo.create({
      data: { oficina_id: oficinaId, cliente_id: cliente.id, combustivel: "Flex", quilometragem: 50000, ...veiculo },
    });
    clientes.push({ cliente, veiculo: v });
  }

  // Ordens de servico em status variados
  const ordensDef = [
    { idx: 0, status: "concluida" as const, abertura: -10, fechamento: -8, servico: 0, peca: 0, qtdPeca: 4 },
    { idx: 1, status: "em_andamento" as const, abertura: -2, servico: 3, peca: 2, qtdPeca: 1 },
    { idx: 2, status: "aberta" as const, abertura: 0, servico: 4 },
    { idx: 3, status: "concluida" as const, abertura: -20, fechamento: -18, servico: 2, peca: 1, qtdPeca: 1 },
  ];

  const ordens = [];
  for (const o of ordensDef) {
    const { cliente, veiculo } = clientes[o.idx];
    const servico = servicos[o.servico];
    const itens: Prisma.item_ordem_servicoCreateWithoutOrdem_servicoInput[] = [
      { tipo_item: "servico", servico: { connect: { id: servico.id } }, quantidade: 1, preco_unitario: servico.preco, subtotal: servico.preco },
    ];
    if (o.peca !== undefined) {
      const peca = pecas[o.peca];
      const qtd = o.qtdPeca ?? 1;
      itens.push({ tipo_item: "peca", peca: { connect: { id: peca.id } }, quantidade: qtd, preco_unitario: peca.preco_venda, subtotal: peca.preco_venda.mul(qtd) });
    }
    const total = itens.reduce((acc, i) => acc.add(i.subtotal as Prisma.Decimal), new Prisma.Decimal(0));

    ordens.push(
      await prisma.ordem_servico.create({
        data: {
          oficina_id: oficinaId,
          cliente_id: cliente.id,
          veiculo_id: veiculo.id,
          funcionario_id: mecanico.id,
          status: o.status,
          data_abertura: dias(o.abertura),
          data_fechamento: o.fechamento !== undefined ? dias(o.fechamento) : null,
          valor_total: total,
          itens: { create: itens },
        },
      })
    );
  }

  // Orcamentos
  const orcamentosDef = [
    { idx: 4, status: "analise" as const, servico: 2, descricao: "Revisão dos 60 mil km" },
    { idx: 1, status: "aprovado" as const, servico: 3, descricao: "Troca de pastilhas" },
    { idx: 2, status: "recusado" as const, servico: 1, descricao: "Alinhamento" },
  ];
  for (const o of orcamentosDef) {
    const { cliente, veiculo } = clientes[o.idx];
    const servico = servicos[o.servico];
    await prisma.orcamento.create({
      data: {
        cliente_id: cliente.id,
        veiculo_id: veiculo.id,
        descricao: o.descricao,
        valor: servico.preco,
        status: o.status,
        data: dias(-3),
        validade: dias(12),
        itens: {
          create: [{ tipo_item: "servico", servico_id: servico.id, nome: servico.nome, quantidade: 1, preco_unitario: servico.preco, subtotal: servico.preco }],
        },
      },
    });
  }

  // Financeiro: recebimentos das OS e algumas contas a pagar
  const titulos: Array<{
    tipo: "receber" | "pagar";
    valor: Prisma.Decimal | number;
    vencimento: number;
    pago: boolean;
    descricao: string;
    categoria: string;
    cliente_id?: number;
    ordem_servico_id?: number;
    fornecedor_id?: number;
  }> = [
    { tipo: "receber", valor: ordens[0].valor_total, vencimento: -8, pago: true, descricao: `OS #${ordens[0].id}`, categoria: "Serviços", cliente_id: ordens[0].cliente_id, ordem_servico_id: ordens[0].id },
    { tipo: "receber", valor: ordens[3].valor_total, vencimento: -5, pago: false, descricao: `OS #${ordens[3].id}`, categoria: "Serviços", cliente_id: ordens[3].cliente_id, ordem_servico_id: ordens[3].id },
    { tipo: "receber", valor: ordens[1].valor_total, vencimento: 5, pago: false, descricao: `OS #${ordens[1].id}`, categoria: "Serviços", cliente_id: ordens[1].cliente_id, ordem_servico_id: ordens[1].id },
    { tipo: "pagar", valor: 1200, vencimento: -3, pago: true, descricao: "Compra de peças", categoria: "Fornecedores", fornecedor_id: fornecedor.id },
    { tipo: "pagar", valor: 2500, vencimento: 7, pago: false, descricao: "Aluguel", categoria: "Despesas fixas" },
    { tipo: "pagar", valor: 350, vencimento: 2, pago: false, descricao: "Conta de energia", categoria: "Despesas fixas" },
  ];
  for (const { vencimento, pago, valor, ...t } of titulos) {
    const pagamento = await prisma.pagamento.create({
      data: {
        oficina_id: oficinaId,
        ...t,
        valor,
        valor_original: valor,
        valor_pago: pago ? valor : 0,
        status: pago ? "pago" : "pendente",
        metodo: pago ? "pix" : null,
        data_vencimento: dias(vencimento),
        data_pagamento: pago ? dias(vencimento) : null,
      },
    });
    if (pago) {
      await prisma.pagamento_movimento.create({
        data: { pagamento_id: pagamento.id, oficina_id: oficinaId, tipo: "pagamento", valor, metodo: "pix", usuario_id: usuarioId },
      });
    }
  }

  // Agenda da semana
  const agendaDef = [
    { idx: 2, offset: 0, hora: 10, titulo: "Diagnóstico eletrônico", status: "confirmado" as const, ordem: ordens[2].id },
    { idx: 4, offset: 1, hora: 9, titulo: "Revisão completa", status: "pendente" as const },
    { idx: 0, offset: 2, hora: 14, titulo: "Troca de óleo", status: "confirmado" as const },
    { idx: 3, offset: -1, hora: 15, titulo: "Alinhamento", status: "realizado" as const },
  ];
  for (const a of agendaDef) {
    const { cliente, veiculo } = clientes[a.idx];
    await prisma.agendamento.create({
      data: {
        oficina_id: oficinaId,
        cliente_id: cliente.id,
        veiculo_id: veiculo.id,
        funcionario_id: mecanico.id,
        ordem_servico_id: a.ordem ?? null,
        titulo: a.titulo,
        status: a.status,
        data_inicio: dias(a.offset, a.hora),
        data_fim: dias(a.offset, a.hora + 1),
      },
    });
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed:dev nao deve rodar em producao.");
  }

  const { oficina, usuario, cidade } = await criarOficinaEGestor();

  const jaTemDados = await prisma.cliente.count({ where: { oficina_id: oficina.id } });
  if (jaTemDados) {
    console.log("Oficina ja possui dados, pulando dados de exemplo.");
  } else {
    await criarDadosExemplo(oficina.id, usuario.id, cidade.id);
    console.log("Dados de exemplo criados.");
  }

  console.log(`Oficina: ${oficina.nome} (id ${oficina.id})`);
  console.log(`Login: ${EMAIL} / ${SENHA}`);
}

main()
  .catch((error) => {
    console.error("Falha no seed de dev:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
