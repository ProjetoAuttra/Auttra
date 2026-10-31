import * as React from "react";
import {
  Box, Stack, Typography, Button,
  IconButton, Table, TableBody, TableCell, TableHead,
  TableRow, Menu, MenuItem, Fade, Chip, TablePagination,
  CircularProgress, Divider, Link,
} from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import RequestQuoteRoundedIcon from "@mui/icons-material/RequestQuoteRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import { useNavigate } from "react-router-dom";

import { useToast } from "../../../context/ToastContext";
import { useConfirm } from "../../../context/ConfirmContext";
import { paths } from "../../../routes/paths";
import api from "../../../api/api";
import ListTableContainer from "../../../components/common/ListTableContainer";
import EmptyState from "../../../components/common/EmptyState";
import { IllustrationOrcamentos } from "../../../components/common/Illustrations";
import { useListaPaginada } from "../../../hooks/useListaPaginada";
import ModuleHeader from "../../../components/layout/ModuleHeader";
import FiltrosRelatorio, { type CampoFiltro } from "../../relatorios/shared/FiltrosRelatorio";
import { periodoMesAtual } from "../../relatorios/shared/reportUtils";

// ─── Tipos ─────────────────────────────────────────────────────────────────

type Orcamento = {
  id: number;
  descricao: string;
  valor: number;
  data: string;
  validade?: string | null;
  status: "analise" | "aprovado" | "recusado";
  cliente: { id: number; nome: string; telefone?: string };
  veiculo: { id: number; modelo: string; placa: string };
  itens?: Array<{
    id: number | string;
    tipo_item: "servico" | "peca";
    nome?: string | null;
    servico_id?: number | null;
    peca_id?: number | null;
    servico?: { id: number; nome: string } | null;
    peca?: { id: number; nome: string } | null;
    quantidade: number;
    preco_unitario: number;
    subtotal: number;
  }>;
  /** O.S. ativa gerada a partir do orçamento (no máximo uma). */
  ordens?: Array<{ id: number; status: string }>;
};

// ─── Config de status ─────────────────────────────────────────────────────

const STATUS_CONFIG = {
  analise: { label: "Em análise", chipColor: "warning" as const },
  aprovado: { label: "Aprovado", chipColor: "success" as const },
  recusado: { label: "Recusado", chipColor: "error" as const },
};

// ─── Filtros ──────────────────────────────────────────────────────────────

type FiltrosOrcamentos = { de: string; ate: string; situacao: string[]; os: string };
const filtrosPadrao = (): FiltrosOrcamentos => ({ ...periodoMesAtual(), situacao: [], os: "" });

const CAMPOS_FILTRO: CampoFiltro<FiltrosOrcamentos>[] = [
  {
    id: "situacao",
    label: "Situação",
    multi: true,
    vazio: "Todas as situações",
    opcoes: [{ value: "analise", label: "Em análise" }, { value: "aprovado", label: "Aprovados" }, { value: "recusado", label: "Recusados" }],
  },
  {
    id: "os",
    label: "Ordem de serviço",
    opcoes: [{ value: "com", label: "Com O.S. gerada" }, { value: "sem", label: "Sem O.S." }],
  },
];

// ─── Componente ────────────────────────────────────────────────────────────

export default function OrcamentosPage() {
  const { success, error, warning } = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();

  const [padrao] = React.useState(filtrosPadrao);
  const [filtros, setFiltros] = React.useState(padrao);
  const filtrado = JSON.stringify(filtros) !== JSON.stringify(padrao);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const { rows: orcamentos, total, carregandoInicial, page, setPage, rowsPerPage, setRowsPerPage, recarregar } =
    useListaPaginada<Orcamento>("/orcamentos", {
      filtros: { status: filtros.situacao.join(","), data_de: filtros.de, data_ate: filtros.ate, ordem_servico: filtros.os },
      onError: () => error("Não foi possível carregar os orçamentos."),
    });

  // ── Carrega ──
  // ── Menu ──
  const handleMenuClick = (e: React.MouseEvent<HTMLElement>, id: number) => { setAnchorEl(e.currentTarget); setSelectedId(id); };
  // Mantém o selecionado ao fechar: limpar aqui faria o menu trocar de itens durante a animação de saída.
  const handleMenuClose = () => { setAnchorEl(null); };

  const selectedOrcamento = React.useMemo(
    () => orcamentos.find((o) => o.id === selectedId) ?? null,
    [orcamentos, selectedId]
  );

  // ── Aprovar (e oferecer gerar a O.S. em seguida) ──
  const handleAprovar = async (orc: Orcamento) => {
    try {
      await api.patch(`/orcamentos/${orc.id}/status`, { status: "aprovado" });
      recarregar();
    } catch {
      error("Não foi possível aprovar o orçamento.");
      return;
    }
    const gerarAgora = await confirm({
      title: "Orçamento aprovado!",
      message: "Deseja gerar a ordem de serviço agora?",
      confirmLabel: "Gerar O.S.",
      cancelLabel: "Agora não",
      variant: "info",
    });
    if (gerarAgora) handleConverterOS({ ...orc, status: "aprovado" });
    else success("Orçamento aprovado!");
  };

  // ── Recusar ──
  const handleRecusar = async () => {
    if (!selectedId) return;
    handleMenuClose();
    const ok = await confirm({
      title: "Recusar orçamento?",
      message: "O cliente será marcado como recusado.",
      confirmLabel: "Sim, recusar",
      variant: "warning",
    });
    if (!ok) return;
    try {
      await api.patch(`/orcamentos/${selectedId}/status`, { status: "recusado" });
      recarregar();
      success("Orçamento recusado.");
    } catch { error("Não foi possível recusar o orçamento."); }
  };

  // ── Excluir ──
  const handleExcluir = async () => {
    if (!selectedId) return;
    handleMenuClose();
    const ok = await confirm({
      title: "Excluir orçamento?",
      message: "Esta ação não pode ser desfeita.",
      confirmLabel: "Sim, excluir",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/orcamentos/${selectedId}`);
      recarregar();
      success("Orçamento excluído.");
    } catch { error("Não foi possível excluir o orçamento."); }
  };

  // ── Converter em O.S. ──
  const handleConverterOS = (orc?: Orcamento) => {
    const orcamento = orc ?? selectedOrcamento;
    if (!orcamento) return;
    handleMenuClose();

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
        cliente_id: orcamento.cliente.id,
        cliente: { id: orcamento.cliente.id, nome: orcamento.cliente.nome },
        veiculo_id: orcamento.veiculo.id,
        funcionario_id: 0,
        observacoes: `Convertido do orçamento #${orcamento.id}: ${orcamento.descricao}`,
        itens: itensOrcamento,
        orcamento_id: orcamento.id,
      },
    });
  };

  // ── Enviar WhatsApp com PDF ──
  const handleWhatsApp = async () => {
    if (!selectedOrcamento?.cliente?.telefone) {
      warning("Este cliente não possui telefone cadastrado.");
      handleMenuClose();
      return;
    }
    handleMenuClose();

    const orc = selectedOrcamento;
    const tel = orc.cliente.telefone.replace(/\D/g, "");
    const msg = `Olá ${orc.cliente.nome}! Segue o orçamento #${orc.id} no valor de ${Number(orc.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Qualquer dúvida estamos à disposição!`;
    const waUrl = `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`;

    try {
      const res = await api.get(`/orcamentos/${orc.id}/pdf`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const file = new File([blob], `orcamento_${orc.id}.pdf`, { type: "application/pdf" });

      if (navigator.canShare?.({ files: [file] })) {
        // Móvel: share sheet nativo — usuário escolhe WhatsApp
        await navigator.share({ files: [file], text: msg, title: `Orçamento #${orc.id}` });
      } else {
        // Desktop: baixa o PDF e abre WhatsApp com o texto
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `orcamento_${orc.id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        window.open(waUrl, "_blank");
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return; // usuário cancelou o share sheet
      console.error("Erro ao gerar PDF do orçamento:", err);
      // Fallback: abre WhatsApp sem PDF
      window.open(waUrl, "_blank");
      warning("Não foi possível gerar o PDF. WhatsApp aberto sem o arquivo.");
    }
  };

  // ── Criar orçamento ──
  const handlePrint = async () => {
    if (!selectedOrcamento) return;
    const orc = selectedOrcamento;
    const pdfWindow = window.open("", "_blank");
    if (!pdfWindow) {
      handleMenuClose();
      error("O navegador bloqueou a abertura do PDF. Libere pop-ups para imprimir o orçamento.");
      return;
    }

    handleMenuClose();
    try {
      pdfWindow.document.write("<p>Gerando PDF do orçamento...</p>");
      const res = await api.get(`/orcamentos/${orc.id}/pdf`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      pdfWindow.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      console.error("Erro ao gerar PDF do orçamento:", err);
      pdfWindow.close();
      error("Não foi possível gerar o PDF do orçamento.");
    }
  };

  if (carregandoInicial) return <Box sx={{ textAlign: "center", mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 1500, mx: "auto" }}>

      {/* ── Header ── */}
      <ModuleHeader
        title="Orçamentos"
        subtitle="Controle de orçamentos, aprovações e conversão em O.S."
        icon={<RequestQuoteRoundedIcon />}
        actionLabel="Novo Orçamento"
        onAction={() => nav(paths.orcamentoNovo)}
      />

      {/* ── Filtros ── */}
      <FiltrosRelatorio
        valores={filtros}
        onChange={setFiltros}
        padrao={padrao}
        campos={CAMPOS_FILTRO}
        subtitulo="Refine a lista de orçamentos"
      />

      {/* ── Tabela ── */}
      <Fade in timeout={400}>
        <ListTableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Cliente</TableCell>
                <TableCell align="center">Veículo</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell>Valor</TableCell>
                <TableCell>Data</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell align="right" aria-label="Ações" />
              </TableRow>
            </TableHead>
            <TableBody>
              {orcamentos.length > 0 ? orcamentos.map((o) => {
                const st = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.analise;
                const os = o.ordens?.[0];
                // Um botão por situação, com o próximo passo do orçamento; recusado não tem ação.
                const acao =
                  o.status === "analise" ? { label: "APROVAR", onClick: () => handleAprovar(o) }
                  : o.status === "aprovado" && os ? { label: "VER O.S.", onClick: () => nav(`/ordens/${os.id}`) }
                  : o.status === "aprovado" ? { label: "GERAR O.S.", onClick: () => handleConverterOS(o) }
                  : null;
                return (
                  <TableRow
                    key={o.id}
                    hover
                    onDoubleClick={() => nav(`/orcamentos/${o.id}`)}
                    sx={{ height: 56, cursor: "pointer" }}
                  >
                    {/* Cliente */}
                    <TableCell>
                      <Stack spacing={0.1}>
                        <Typography variant="body2" fontWeight={600}>{o.cliente?.nome ?? "—"}</Typography>
                      </Stack>
                    </TableCell>

                    {/* Veículo */}
                    <TableCell align="center">
                      <Typography variant="body2">{o.veiculo?.modelo ?? "—"}</Typography>
                      <Typography variant="caption" color="text.disabled">{o.veiculo?.placa ?? "—"}</Typography>
                    </TableCell>

                    {/* Descrição */}
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Typography variant="body2" color="text.secondary" noWrap>{o.descricao}</Typography>
                    </TableCell>

                    {/* Valor */}
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        R$ {Number(o.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </Typography>
                    </TableCell>

                    {/* Data */}
                    <TableCell>
                      <Stack spacing={0.1}>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(o.data).toLocaleDateString("pt-BR")}
                        </Typography>
                        {o.validade && (
                          <Typography variant="caption" color="text.secondary">
                            Válido até {new Date(o.validade).toLocaleDateString("pt-BR")}
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>

                    {/* Status + O.S. gerada */}
                    <TableCell>
                      <Stack spacing={0.5} alignItems="flex-start">
                        <Chip
                          label={st.label}
                          size="small"
                          color={st.chipColor}
                          sx={{ fontWeight: 600, fontSize: 12 }}
                        />
                        {os && (
                          <Link
                            component="button"
                            variant="caption"
                            fontWeight={600}
                            underline="hover"
                            onClick={(e) => { e.stopPropagation(); nav(`/ordens/${os.id}`); }}
                          >
                            O.S. #{os.id}
                          </Link>
                        )}
                      </Stack>
                    </TableCell>

                    {/* Ações */}
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="text"
                          color="primary"
                          onClick={acao?.onClick}
                          tabIndex={acao ? 0 : -1}
                          aria-hidden={!acao}
                          sx={{
                            fontWeight: 700,
                            letterSpacing: 0.6,
                            px: 1.75,
                            whiteSpace: "nowrap",
                            // Sem ação (recusado): ocupa o espaço para os três pontos não mudarem de lugar.
                            visibility: acao ? "visible" : "hidden",
                          }}
                        >
                          {acao?.label ?? "GERAR O.S."}
                        </Button>
                        <IconButton size="small" aria-label="Mais ações" onClick={(e) => handleMenuClick(e, o.id)}>
                          <MoreVertRoundedIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={7} sx={{ border: 0 }}>
                    <EmptyState
                      illustration={<IllustrationOrcamentos />}
                      icon={<RequestQuoteRoundedIcon />}
                      title={filtrado ? "Nenhum orçamento encontrado" : "Nenhum orçamento neste mês"}
                      description="Crie o primeiro orçamento e acompanhe sua conversão em ordem de serviço."
                      actionLabel="Novo Orçamento"
                      onAction={() => nav(paths.orcamentoNovo)}
                      isFiltered={filtrado}
                      onClearFilter={() => setFiltros(padrao)}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ListTableContainer>
      </Fade>

      {/* ── Paginação ── */}
      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[5, 10, 20]}
        labelRowsPerPage="Linhas por página:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `mais de ${to}`}`}
        sx={{ bgcolor: "transparent", borderTop: (t) => `1px solid ${t.palette.divider}` }}
      />

      {/* ── Menu contextual ── */}
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={() => { handleMenuClose(); if (selectedId) nav(`/orcamentos/${selectedId}`); }}>
          <VisibilityRoundedIcon fontSize="small" sx={{ mr: 1.5, color: "text.secondary" }} />Ver detalhes
        </MenuItem>
        <Divider />
        {selectedOrcamento?.status === "analise" && (
          <MenuItem onClick={handleRecusar} sx={{ color: "error.main" }}>
            <CancelRoundedIcon fontSize="small" sx={{ mr: 1.5 }} />Recusar
          </MenuItem>
        )}
        {selectedOrcamento?.status === "analise" && <Divider />}
        <MenuItem onClick={handleWhatsApp}>
          <WhatsAppIcon fontSize="small" sx={{ mr: 1.5, color: "#25D366" }} />Enviar WhatsApp
        </MenuItem>
        <MenuItem onClick={handlePrint}>
          <PrintRoundedIcon fontSize="small" sx={{ mr: 1.5, color: "text.secondary" }} />Imprimir
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleExcluir} sx={{ color: "error.main" }}>
          <DeleteOutlineRoundedIcon fontSize="small" sx={{ mr: 1.5 }} />Excluir
        </MenuItem>
      </Menu>

    </Box>
  );
}
