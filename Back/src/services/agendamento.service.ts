import { prisma } from "../prisma/client.js";

function toAgendamentoData(data: any, partial = false) {
  const payload: any = {};

  const titulo = data.titulo ?? data.title;
  const descricao = data.descricao ?? data.description;
  const dataInicio = data.data_inicio ?? data.start;
  const dataFim = data.data_fim ?? data.end;
  const localizacao = data.localizacao ?? data.location;
  const observacao = data.observacao;
  const status = data.status;
  const oficinaId = data.oficina_id ?? data.oficinaId;
  const clienteId = data.cliente_id ?? data.clienteId;
  const veiculoId = data.veiculo_id ?? data.veiculoId;
  const funcionarioId = data.funcionario_id ?? data.funcionarioId;
  const ordemServicoId = data.ordem_servico_id ?? data.ordemServicoId;

  if (titulo != null) payload.titulo = String(titulo);
  if (descricao != null) payload.descricao = descricao || null;
  if (dataInicio != null) payload.data_inicio = new Date(dataInicio);
  if (dataFim != null) payload.data_fim = new Date(dataFim);
  if (localizacao != null) payload.localizacao = localizacao || null;
  if (observacao != null) payload.observacao = observacao || null;
  if (status != null) payload.status = status;
  if (oficinaId != null) payload.oficina_id = Number(oficinaId);
  if (clienteId != null) payload.cliente_id = Number(clienteId);
  if (veiculoId != null) payload.veiculo_id = Number(veiculoId);
  if (funcionarioId != null && funcionarioId !== "") payload.funcionario_id = Number(funcionarioId);
  if (ordemServicoId != null) payload.ordem_servico_id = ordemServicoId === "" ? null : Number(ordemServicoId);

  if (!partial) {
    for (const field of ["titulo", "data_inicio", "data_fim", "oficina_id", "cliente_id", "veiculo_id"]) {
      if (payload[field] == null || (payload[field] instanceof Date && Number.isNaN(payload[field].getTime()))) {
        throw new Error(`${field} e obrigatorio.`);
      }
    }
  }

  if (payload.data_inicio instanceof Date && Number.isNaN(payload.data_inicio.getTime())) {
    throw new Error("data_inicio invalida.");
  }
  if (payload.data_fim instanceof Date && Number.isNaN(payload.data_fim.getTime())) {
    throw new Error("data_fim invalida.");
  }

  return payload;
}

const includeRelations = {
  cliente: true,
  veiculo: true,
  funcionario: true,
  ordem_servico: { select: { id: true, status: true, valor_total: true } },
};

async function validateAgendamentoRelations(data: any, oficinaId: number) {
  if (data.cliente_id != null) {
    const cliente = await prisma.cliente.findFirst({
      where: { id: Number(data.cliente_id), oficina_id: oficinaId, deleted_at: null },
    });
    if (!cliente) throw new Error("Cliente nao encontrado nesta oficina.");
  }

  if (data.veiculo_id != null) {
    const veiculo = await prisma.veiculo.findFirst({
      where: { id: Number(data.veiculo_id), oficina_id: oficinaId, deleted_at: null },
    });
    if (!veiculo) throw new Error("Veiculo nao encontrado nesta oficina.");
  }

  if (data.funcionario_id != null) {
    const funcionario = await prisma.funcionario.findFirst({
      where: { id: Number(data.funcionario_id), oficina_id: oficinaId, deleted_at: null },
    });
    if (!funcionario) throw new Error("Funcionario nao encontrado nesta oficina.");
  }
}

export const AgendamentoService = {
  async list(oficina_id: number) {
    return prisma.agendamento.findMany({ where: { oficina_id, deleted_at: null }, include: includeRelations });
  },

  async getById(id: number, oficina_id: number) {
    return prisma.agendamento.findFirst({ where: { id, oficina_id, deleted_at: null }, include: includeRelations });
  },

  async listByOficina(oficina_id: number) {
    return prisma.agendamento.findMany({ where: { oficina_id, deleted_at: null }, include: includeRelations });
  },

  async create(data: any) {
    const payload = toAgendamentoData(data);
    await validateAgendamentoRelations(payload, payload.oficina_id);
    return prisma.agendamento.create({ data: payload, include: includeRelations });
  },

  async update(id: number, data: any, oficina_id: number) {
    const existing = await prisma.agendamento.findFirst({ where: { id, oficina_id, deleted_at: null } });
    if (!existing) throw new Error("Agendamento nao encontrado nesta oficina.");
    const patch = toAgendamentoData(data, true);
    patch.oficina_id = oficina_id;
    await validateAgendamentoRelations(patch, oficina_id);

    return prisma.agendamento.update({
      where: { id },
      data: patch,
      include: includeRelations,
    });
  },

  async remove(id: number, oficina_id: number) {
    const existing = await prisma.agendamento.findFirst({ where: { id, oficina_id, deleted_at: null } });
    if (!existing) throw new Error("Agendamento nao encontrado nesta oficina.");

    return prisma.agendamento.update({ where: { id }, data: { deleted_at: new Date(), status: "cancelado" } });
  }
};
