import * as React from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import { paths } from "../../routes/paths";

/** O que as ações precisam do orçamento (lista e detalhe trazem o mesmo formato da API). */
export type OrcamentoParaAcao = {
  id: number;
  descricao?: string | null;
  valor: number;
  status: "analise" | "aprovado" | "recusado";
  cliente?: { id: number; nome: string } | null;
  veiculo?: { id: number } | null;
  itens?: Array<{
    id: number | string;
    tipo_item: "servico" | "peca";
    nome?: string | null;
    servico_id?: number | null;
    peca_id?: number | null;
    servico?: { id?: number; nome: string } | null;
    peca?: { id?: number; nome: string } | null;
    quantidade: number;
    preco_unitario: number;
    subtotal: number;
  }>;
  /** O.S. ativa gerada a partir do orçamento (no máximo uma). */
  ordens?: Array<{ id: number; status: string }>;
};

export type AcaoOrcamento = { rotulo: string; onClick: () => void };

/**
 * Ações de fluxo do orçamento (aprovar, recusar, gerar e ver a O.S.), usadas na lista e no detalhe.
 * `onAtualizado` recarrega a tela depois de mudar a situação.
 */
export function useAcoesOrcamento(onAtualizado: () => void) {
  const nav = useNavigate();
  const confirm = useConfirm();
  const { can } = useAuth();
  const { success, error } = useToast();

  const gerarOS = React.useCallback((orcamento: OrcamentoParaAcao) => {
    const itensOrcamento = orcamento.itens?.length
      ? orcamento.itens.map((item) => ({
          id: `orcamento-item-${item.id}`,
          tipo_item: item.tipo_item,
          nome: item.nome ?? item.servico?.nome ?? item.peca?.nome ?? "Item do orçamento",
          servico_id: item.tipo_item === "servico" ? item.servico_id ?? item.servico?.id ?? null : null,
          peca_id: item.tipo_item === "peca" ? item.peca_id ?? item.peca?.id ?? null : null,
          quantidade: Number(item.quantidade ?? 1),
          preco_unitario: Number(item.preco_unitario ?? 0),
          subtotal: Number(item.subtotal ?? 0),
        }))
      : [
          {
            id: `orcamento-${orcamento.id}`,
            tipo_item: "servico" as const,
            nome: `Orçamento #${orcamento.id}`,
            servico_id: null,
            peca_id: null,
            quantidade: 1,
            preco_unitario: Number(orcamento.valor),
            subtotal: Number(orcamento.valor),
          },
        ];

    nav(paths.ordemNova, {
      state: {
        cliente_id: orcamento.cliente?.id,
        cliente: orcamento.cliente ? { id: orcamento.cliente.id, nome: orcamento.cliente.nome } : undefined,
        veiculo_id: orcamento.veiculo?.id,
        funcionario_id: 0,
        observacoes: `Convertido do orçamento #${orcamento.id}: ${orcamento.descricao ?? ""}`,
        itens: itensOrcamento,
        orcamento_id: orcamento.id,
      },
    });
  }, [nav]);

  // Aprova e oferece gerar a O.S. em seguida.
  const aprovar = React.useCallback(async (orc: OrcamentoParaAcao) => {
    try {
      await api.patch(`/orcamentos/${orc.id}/status`, { status: "aprovado" });
      onAtualizado();
    } catch {
      error("Não foi possível aprovar o orçamento.");
      return;
    }
    const gerarAgora = can("ordens", "create") && await confirm({
      title: "Orçamento aprovado!",
      message: "Deseja gerar a ordem de serviço agora?",
      confirmLabel: "Gerar O.S.",
      cancelLabel: "Agora não",
      variant: "info",
    });
    if (gerarAgora) gerarOS({ ...orc, status: "aprovado" });
    else success("Orçamento aprovado!");
  }, [can, confirm, error, gerarOS, onAtualizado, success]);

  const recusar = React.useCallback(async (orc: OrcamentoParaAcao) => {
    const ok = await confirm({
      title: "Recusar orçamento?",
      message: "O cliente será marcado como recusado.",
      confirmLabel: "Sim, recusar",
      variant: "warning",
    });
    if (!ok) return;
    try {
      await api.patch(`/orcamentos/${orc.id}/status`, { status: "recusado" });
      onAtualizado();
      success("Orçamento recusado.");
    } catch { error("Não foi possível recusar o orçamento."); }
  }, [confirm, error, onAtualizado, success]);

  const podeMudarSituacao = can("orcamentos", "update");
  const podeRecusar = (orc: OrcamentoParaAcao) => orc.status === "analise" && podeMudarSituacao;

  /** Próximo passo do orçamento conforme a situação; recusado (ou sem permissão) não tem ação. */
  const acaoPrincipal = (orc: OrcamentoParaAcao): AcaoOrcamento | null => {
    const os = orc.ordens?.[0];
    if (orc.status === "analise") return podeMudarSituacao ? { rotulo: "Aprovar", onClick: () => aprovar(orc) } : null;
    if (orc.status === "aprovado" && os) return can("ordens") ? { rotulo: "Ver O.S.", onClick: () => nav(`/ordens/${os.id}`) } : null;
    if (orc.status === "aprovado") return can("ordens", "create") ? { rotulo: "Gerar O.S.", onClick: () => gerarOS(orc) } : null;
    return null;
  };

  return { aprovar, recusar, gerarOS, acaoPrincipal, podeRecusar };
}
