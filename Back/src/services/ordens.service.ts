import { prisma } from "../prisma/client.js";

async function validateOrdemRelations(data: any, oficinaId: number) {
  const [cliente, veiculo, funcionario] = await Promise.all([
    prisma.cliente.findFirst({ where: { id: Number(data.cliente_id), oficina_id: oficinaId, deleted_at: null } }),
    prisma.veiculo.findFirst({ where: { id: Number(data.veiculo_id), oficina_id: oficinaId, deleted_at: null } }),
    prisma.funcionario.findFirst({ where: { id: Number(data.funcionario_id), oficina_id: oficinaId, deleted_at: null } }),
  ]);

  if (!cliente) throw new Error("Cliente nao encontrado nesta oficina.");
  if (!veiculo) throw new Error("Veiculo nao encontrado nesta oficina.");
  if (!funcionario) throw new Error("Funcionario nao encontrado nesta oficina.");

  await Promise.all((data.itens ?? []).map(async (item: any) => {
    if ((item.tipo_item ?? item.tipo) === "servico" && item.servico_id) {
      const servico = await prisma.servico.findFirst({
        where: { id: Number(item.servico_id), oficina_id: oficinaId, deleted_at: null },
      });
      if (!servico) throw new Error("Servico nao encontrado nesta oficina.");
    }
    if ((item.tipo_item ?? item.tipo) === "peca" && item.peca_id) {
      const peca = await prisma.peca.findFirst({
        where: { id: Number(item.peca_id), oficina_id: oficinaId, deleted_at: null },
      });
      if (!peca) throw new Error("Peca nao encontrada nesta oficina.");
    }
  }));
}

export const OrdensService = {
  list: async (oficinaId: number) => {
    return prisma.ordem_servico.findMany({
      where: { deleted_at: null, oficina_id: oficinaId },
      orderBy: { created_at: "desc" },
      take: 200,
      include: {
        cliente: true,
        veiculo: true,
        funcionario: true,
        itens: { include: { servico: true, peca: true } },
      },
    });
  },

  getById: async (id: number, oficinaId: number) => {
    const os = await prisma.ordem_servico.findFirst({
      where: { id, deleted_at: null, oficina_id: oficinaId },
      include: {
        cliente: true,
        veiculo: true,
        funcionario: true,
        itens: { include: { servico: true, peca: true } },
      },
    });
    if (!os) throw new Error("Ordem de serviço não encontrada.");
    return os;
  },

  create: async (data: any) => {
    const { oficina_id, cliente_id, veiculo_id, funcionario_id, observacoes, valor_total, itens } = data;

    if (!oficina_id || !cliente_id || !veiculo_id || !funcionario_id) {
      throw new Error("Campos obrigatórios não informados.");
    }
    await validateOrdemRelations({ cliente_id, veiculo_id, funcionario_id, itens }, oficina_id);

    const pecaItens = (itens ?? []).filter((i: any) => (i.tipo_item ?? i.tipo) === "peca" && i.peca_id);

    return prisma.$transaction(async (tx) => {
      for (const item of pecaItens) {
        const peca = await tx.peca.findFirst({
          where: { id: Number(item.peca_id), oficina_id, deleted_at: null },
        });
        if (!peca) throw new Error("Peça não encontrada.");
        if (Number(peca.estoque) < Number(item.quantidade)) {
          throw new Error(`Estoque insuficiente para "${peca.nome}". Disponível: ${peca.estoque}.`);
        }
        await tx.peca.update({
          where: { id: peca.id },
          data: { estoque: { decrement: Number(item.quantidade) } },
        });
      }

      return tx.ordem_servico.create({
        data: {
          oficina_id,
          cliente_id,
          veiculo_id,
          funcionario_id,
          observacoes: observacoes ?? "",
          status: "aberta",
          valor_total: valor_total ?? 0,
          itens: {
            create: (itens ?? []).map((i: any) => ({
              tipo_item: i.tipo_item ?? i.tipo ?? "servico",
              servico_id: (i.tipo_item ?? i.tipo) === "servico" ? i.servico_id ?? null : null,
              peca_id:    (i.tipo_item ?? i.tipo) === "peca"    ? i.peca_id    ?? null : null,
              quantidade:     i.quantidade     ?? 1,
              preco_unitario: i.preco_unitario ?? i.preco ?? 0,
              subtotal:       i.subtotal       ?? 0,
            })),
          },
        },
        include: {
          cliente: true,
          veiculo: true,
          funcionario: true,
          itens: { include: { servico: true, peca: true } },
        },
      });
    });
  },

  update: async (id: number, data: any, oficinaId: number) => {
    const { itens, ...rest } = data;
    const existing = await prisma.ordem_servico.findFirst({
      where: { id, oficina_id: oficinaId, deleted_at: null },
      include: { itens: true },
    });
    if (!existing) throw new Error("Ordem de servico nao encontrada nesta oficina.");

    const VALID_TRANSITIONS: Record<string, string[]> = {
      aberta:       ["em_andamento", "cancelada"],
      em_andamento: ["concluida", "cancelada"],
      concluida:    [],
      cancelada:    [],
    };
    if (rest.status && rest.status !== existing.status) {
      const allowed = VALID_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(rest.status)) {
        throw new Error(`Transição inválida: ${existing.status} → ${rest.status}.`);
      }
    }

    delete rest.oficina_id;
    delete rest.oficinaId;
    await validateOrdemRelations(
      {
        cliente_id:    rest.cliente_id    ?? existing.cliente_id,
        veiculo_id:    rest.veiculo_id    ?? existing.veiculo_id,
        funcionario_id: rest.funcionario_id ?? existing.funcionario_id,
        itens,
      },
      oficinaId
    );

    return prisma.$transaction(async (tx) => {
      const isCancelling = rest.status === "cancelada" && existing.status !== "cancelada";
      const isUpdatingItems = itens && Array.isArray(itens);

      if (isUpdatingItems) {
        // Return stock for old peca items
        const oldPecaItens = (existing.itens as any[]).filter(
          (i) => i.tipo_item === "peca" && i.peca_id && !i.deleted_at
        );
        for (const oldItem of oldPecaItens) {
          await tx.peca.update({
            where: { id: oldItem.peca_id },
            data: { estoque: { increment: Number(oldItem.quantidade) } },
          });
        }

        // Decrement stock for new peca items only when not cancelling
        if (!isCancelling) {
          const newPecaItens = itens.filter(
            (i: any) => (i.tipo_item ?? i.tipo) === "peca" && i.peca_id
          );
          for (const newItem of newPecaItens) {
            const peca = await tx.peca.findFirst({
              where: { id: Number(newItem.peca_id), oficina_id: oficinaId, deleted_at: null },
            });
            if (!peca) throw new Error("Peça não encontrada.");
            if (Number(peca.estoque) < Number(newItem.quantidade)) {
              throw new Error(`Estoque insuficiente para "${peca.nome}". Disponível: ${peca.estoque}.`);
            }
            await tx.peca.update({
              where: { id: peca.id },
              data: { estoque: { decrement: Number(newItem.quantidade) } },
            });
          }
        }
      } else if (isCancelling) {
        // Return stock for current peca items when cancelling without item changes
        const pecaItens = (existing.itens as any[]).filter(
          (i) => i.tipo_item === "peca" && i.peca_id && !i.deleted_at
        );
        for (const item of pecaItens) {
          await tx.peca.update({
            where: { id: item.peca_id },
            data: { estoque: { increment: Number(item.quantidade) } },
          });
        }
      }

      const osAtualizada = await tx.ordem_servico.update({
        where: { id },
        data: { ...rest, oficina_id: oficinaId, updated_at: new Date() },
        include: {
          cliente: true,
          veiculo: true,
          funcionario: true,
          itens: { include: { servico: true, peca: true } },
        },
      });

      if (isUpdatingItems) {
        await tx.item_ordem_servico.deleteMany({ where: { ordem_servico_id: id } });
        await tx.item_ordem_servico.createMany({
          data: itens.map((i: any) => ({
            ordem_servico_id: id,
            tipo_item:        i.tipo_item ?? i.tipo ?? "servico",
            servico_id:       (i.tipo_item ?? i.tipo) === "servico" ? i.servico_id ?? null : null,
            peca_id:          (i.tipo_item ?? i.tipo) === "peca"    ? i.peca_id    ?? null : null,
            quantidade:       i.quantidade     ?? 1,
            preco_unitario:   i.preco_unitario ?? i.preco ?? 0,
            subtotal:         i.subtotal       ?? 0,
          })),
        });
      }

      if (rest.status === "concluida" && existing.status !== "concluida") {
        const valorTotal = Number(osAtualizada.valor_total);
        if (valorTotal > 0) {
          const hoje = new Date();
          await tx.pagamento.create({
            data: {
              tipo:                     "receber",
              oficina_id:               oficinaId,
              cliente_id:               osAtualizada.cliente_id ?? null,
              ordem_servico_id:         osAtualizada.id,
              valor:                    valorTotal,
              valor_original:           valorTotal,
              desconto:                 0,
              valor_pago:               0,
              status:                   "pendente",
              data_vencimento:          hoje,
              data_vencimento_original: hoje,
            },
          });
        }
      }

      return tx.ordem_servico.findUnique({
        where: { id },
        include: {
          cliente: true,
          veiculo: true,
          funcionario: true,
          itens: { include: { servico: true, peca: true } },
        },
      });
    });
  },

  delete: async (id: number, oficinaId: number) => {
    try {
      const existing = await prisma.ordem_servico.findFirst({
        where: { id, oficina_id: oficinaId, deleted_at: null },
        include: { itens: true },
      });
      if (!existing) throw new Error("Ordem de servico nao encontrada nesta oficina.");

      const pagamentoBloqueante = await prisma.pagamento.findFirst({
        where: { ordem_servico_id: id, status: { in: ["pago", "parcial"] }, deleted_at: null },
      });
      if (pagamentoBloqueante) throw new Error("Não é possível excluir uma OS com pagamento já registrado.");

      return await prisma.$transaction(async (tx) => {
        // Cancel pending payments
        await tx.pagamento.updateMany({
          where: { ordem_servico_id: id, status: "pendente", deleted_at: null },
          data: { status: "cancelado", deleted_at: new Date() },
        });

        // Return stock for peca items
        const pecaItens = (existing.itens as any[]).filter(
          (i) => i.tipo_item === "peca" && i.peca_id && !i.deleted_at
        );
        for (const item of pecaItens) {
          await tx.peca.update({
            where: { id: item.peca_id },
            data: { estoque: { increment: Number(item.quantidade) } },
          });
        }

        await tx.item_ordem_servico.updateMany({
          where: { ordem_servico_id: id, deleted_at: null },
          data: { deleted_at: new Date() },
        });

        return tx.ordem_servico.update({
          where: { id },
          data: { deleted_at: new Date(), status: "cancelada" },
        });
      });
    } catch (err: any) {
      console.error("Erro ao excluir OS:", err);
      if (err.code === "P2003") {
        throw new Error("Não é possível excluir esta OS porque há registros vinculados.");
      }
      throw err;
    }
  },
};
