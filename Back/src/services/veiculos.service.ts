import { prisma } from "../prisma/client.js";
import { LIMITE_LISTAGEM } from "../utils/limites.js";
import { listarPaginado, type Paginacao } from "../utils/paginacao.js";

function normalizePlaca(placa: string) {
  return placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const inteiroOuNulo = (valor: unknown, campo: string) => {
  if (valor === null || valor === "") return null;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 0) throw new Error(`Campo ${campo} inválido.`);
  return n;
};
const textoOuNulo = (valor: unknown) => (valor === null || valor === "" ? null : String(valor).trim());

/**
 * Campos que a edicao do veiculo pode alterar, montados um a um. Copiar o body deixava passar
 * relacoes aninhadas (ordens/orcamentos/agendamentos com connect), que trocavam o veiculo de
 * registros de outra oficina.
 */
function camposEditaveisVeiculo(data: any) {
  const patch: {
    cliente_id?: number;
    marca?: string;
    modelo?: string;
    placa?: string;
    ano?: number | null;
    cor?: string | null;
    combustivel?: string | null;
    quilometragem?: number | null;
    observacao?: string | null;
  } = {};
  if (!data || typeof data !== "object") return patch;

  if (data.cliente_id !== undefined && data.cliente_id !== null && data.cliente_id !== "") {
    const clienteId = Number(data.cliente_id);
    if (!Number.isInteger(clienteId) || clienteId <= 0) throw new Error("Campo cliente_id inválido.");
    patch.cliente_id = clienteId;
  }
  for (const campo of ["marca", "modelo"] as const) {
    if (data[campo] === undefined) continue;
    const valor = String(data[campo] ?? "").trim();
    if (!valor) throw new Error(`O campo ${campo} é obrigatório.`);
    patch[campo] = valor;
  }
  if (data.placa !== undefined) {
    const placa = normalizePlaca(String(data.placa ?? ""));
    if (!placa) throw new Error("O campo placa é obrigatório.");
    patch.placa = placa;
  }
  if (data.ano !== undefined) patch.ano = inteiroOuNulo(data.ano, "ano");
  if (data.quilometragem !== undefined) patch.quilometragem = inteiroOuNulo(data.quilometragem, "quilometragem");
  for (const campo of ["cor", "combustivel", "observacao"] as const) {
    if (data[campo] !== undefined) patch[campo] = textoOuNulo(data[campo]);
  }
  return patch;
}

export const VeiculosService = {
  list: (filters: { oficina_id: number; cliente_id?: number; search?: string }, pag: Paginacao | null = null) => {
    const where: any = { deleted_at: null, oficina_id: filters.oficina_id };
    if (filters?.cliente_id) where.cliente_id = filters.cliente_id;
    if (filters.search) {
      const contains = { contains: filters.search, mode: "insensitive" };
      where.OR = [
        { modelo: contains },
        { marca: contains },
        { placa: contains },
        { cor: contains },
        { cliente: { nome: contains } },
      ];
    }

    return listarPaginado(pag, {
      find: ({ skip, take }) =>
        prisma.veiculo.findMany({ where, include: { cliente: true, oficina: true }, orderBy: { id: "desc" }, skip, take }),
      count: () => prisma.veiculo.count({ where }),
    });
  },

  getById: (id: number, oficinaId: number) =>
    prisma.veiculo.findFirst({
      where: { id, deleted_at: null, oficina_id: oficinaId },
      include: {
        cliente: true,
        ordens: {
          where: { deleted_at: null },
          orderBy: { data_abertura: "desc" },
          include: { funcionario: true },
        },
      },
    }),

  create: async (data: any) => {
    const clienteId = Number(data.cliente_id ?? data.clienteId);
    const oficinaId = Number(data.oficina_id ?? data.oficinaId);
    const placa = normalizePlaca(String(data.placa ?? ""));

    if (!clienteId || !oficinaId || !placa || !data.marca || !data.modelo) {
      throw new Error("cliente_id, oficina_id, placa, marca e modelo sao obrigatorios.");
    }

    const cliente = await prisma.cliente.findFirst({
      where: { id: clienteId, oficina_id: oficinaId, deleted_at: null },
    });
    if (!cliente) throw new Error("Cliente nao encontrado nesta oficina.");

    const existing = await prisma.veiculo.findFirst({
      where: { placa, oficina_id: oficinaId },
    });

    if (existing) {
      return prisma.veiculo.update({
        where: { id: existing.id },
        data: {
          cliente_id: clienteId,
          marca: data.marca,
          modelo: data.modelo,
          ano: data.ano ? Number(data.ano) : null,
          cor: data.cor ?? null,
          combustivel: data.combustivel ?? null,
          quilometragem: data.quilometragem ? Number(data.quilometragem) : null,
          observacao: data.observacao ?? null,
          deleted_at: null,
        },
      });
    }

    return prisma.veiculo.create({
      data: {
        cliente_id: clienteId,
        oficina_id: oficinaId,
        placa,
        marca: data.marca,
        modelo: data.modelo,
        ano: data.ano ? Number(data.ano) : null,
        cor: data.cor ?? null,
        combustivel: data.combustivel ?? null,
        quilometragem: data.quilometragem ? Number(data.quilometragem) : null,
        observacao: data.observacao ?? null,
      },
    });
  },

  update: async (id: number, data: any, oficinaId: number) => {
    const patch = camposEditaveisVeiculo(data);

    const existing = await prisma.veiculo.findFirst({ where: { id, oficina_id: oficinaId, deleted_at: null } });
    if (!existing) throw new Error("Veiculo nao encontrado nesta oficina.");

    if (patch.cliente_id) {
      const cli = await prisma.cliente.findFirst({
        where: { id: patch.cliente_id, oficina_id: oficinaId, deleted_at: null },
      });
      if (!cli) throw new Error("Cliente nao encontrado nesta oficina.");
    }

    return prisma.veiculo.update({ where: { id }, data: patch });
  },

  remove: async (id: number, oficinaId: number) => {
    const existing = await prisma.veiculo.findFirst({ where: { id, oficina_id: oficinaId, deleted_at: null } });
    if (!existing) throw new Error("Veiculo nao encontrado nesta oficina.");

    return prisma.veiculo.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  },
};
