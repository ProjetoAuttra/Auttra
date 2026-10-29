import * as React from "react";
import {
  Box, Stack, Typography,
  IconButton, Table, TableBody, TableCell, TableHead,
  TableRow, Menu, MenuItem, Fade, Chip, TablePagination,
  CircularProgress, Divider, ToggleButton, ToggleButtonGroup, Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { brand } from "../../../app/theme";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import RequestQuoteRoundedIcon from "@mui/icons-material/RequestQuoteRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
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
};

// ─── Config de status ─────────────────────────────────────────────────────

const STATUS_CONFIG = {
  analise: { label: "Em análise", color: brand.amber, bg: alpha(brand.amber, 0.1), chipColor: "warning" as const },
  aprovado: { label: "Aprovado", color: brand.success, bg: alpha(brand.success, 0.1), chipColor: "success" as const },
  recusado: { label: "Recusado", color: brand.error, bg: alpha(brand.error, 0.1), chipColor: "error" as const },
};

// ─── Componente ────────────────────────────────────────────────────────────

export default function OrcamentosPage() {
  const { success, error, warning } = useToast();
  const confirm = useConfirm();
  const nav = useNavigate();

  const [query, setQuery] = React.useState("");
  const [filtroStatus, setFiltroStatus] = React.useState<string>("analise");
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const { rows: orcamentos, total, carregandoInicial, page, setPage, rowsPerPage, setRowsPerPage, recarregar } =
    useListaPaginada<Orcamento>("/orcamentos", {
      filtros: { search: query, status: filtroStatus },
      onError: () => error("Não foi possível carregar os orçamentos."),
    });

  // ── Carrega ──
  // ── Menu ──
  const handleMenuClick = (e: React.MouseEvent<HTMLElement>, id: number) => { setAnchorEl(e.currentTarget); setSelectedId(id); };
  const handleMenuClose = () => { setAnchorEl(null); setSelectedId(null); };

  const selectedOrcamento = React.useMemo(
    () => orcamentos.find((o) => o.id === selectedId) ?? null,
    [orcamentos, selectedId]
  );

  // ── Aprovar ──
  const handleAprovar = async () => {
    if (!selectedId) return;
    handleMenuClose();
    try {
      await api.patch(`/orcamentos/${selectedId}/status`, { status: "aprovado" });
      recarregar();
      success("Orçamento aprovado!");
    } catch { error("Não foi possível aprovar o orçamento."); }
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
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mb={2.5} alignItems="center">
        <ToggleButtonGroup
          value={filtroStatus}
          exclusive
          onChange={(_, v) => { if (v !== null) setFiltroStatus(v); }}
          size="small"
          sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 600, px: 2, borderRadius: "999px !important", border: (t) => `1px solid ${t.palette.divider} !important`, mx: 0.25 } }}
        >
          <ToggleButton value="todos">Todos</ToggleButton>
          <ToggleButton value="analise" sx={{ "&.Mui-selected": { bgcolor: alpha(brand.amber, 0.1), color: brand.amber } }}>Em análise</ToggleButton>
          <ToggleButton value="aprovado" sx={{ "&.Mui-selected": { bgcolor: alpha(brand.success, 0.1), color: brand.success } }}>Aprovados</ToggleButton>
          <ToggleButton value="recusado" sx={{ "&.Mui-selected": { bgcolor: alpha(brand.error, 0.1), color: brand.error } }}>Recusados</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* ── Tabela ── */}
      <Fade in timeout={400}>
        <ListTableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Cliente</TableCell>
                <TableCell>Veículo</TableCell>
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
                    <TableCell>
                      {o.veiculo ? (
                        <Stack spacing={0.1}>
                          <Typography variant="body2">{o.veiculo.modelo}</Typography>
                          <Typography variant="caption" fontFamily="monospace" fontWeight={600}
                            sx={{ px: 0.75, py: 0.1, borderRadius: 1, bgcolor: (t) => alpha(t.palette.text.primary, 0.06), display: "inline-block", width: "fit-content" }}>
                            {o.veiculo.placa}
                          </Typography>
                        </Stack>
                      ) : "—"}
                    </TableCell>

                    {/* Descrição */}
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Typography variant="body2" color="text.secondary" noWrap>{o.descricao}</Typography>
                    </TableCell>

                    {/* Valor */}
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} color="success.main">
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

                    {/* Status */}
                    <TableCell>
                      <Chip
                        label={st.label}
                        size="small"
                        color={st.chipColor}
                        sx={{ fontWeight: 600, fontSize: 12 }}
                      />
                    </TableCell>

                    {/* Ações */}
                    <TableCell align="right">
                      {/* Botão rápido: Converter em OS (só para aprovados ou em análise) */}
                      {o.status !== "recusado" && (
                        <Tooltip title="Converter em O.S.">
                          <IconButton
                            size="small"
                            onClick={() => handleConverterOS(o)}
                            sx={{ mr: 0.5, color: "primary.main", "&:hover": { bgcolor: (t) => alpha(t.palette.primary.main, 0.08) } }}
                          >
                            <BuildRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <IconButton size="small" onClick={(e) => handleMenuClick(e, o.id)}>
                        <MoreVertRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={7} sx={{ border: 0 }}>
                    <EmptyState
                      illustration={<IllustrationOrcamentos />}
                      icon={<RequestQuoteRoundedIcon />}
                      title={filtroStatus === "todos" ? "Nenhum orçamento cadastrado" : `Nenhum orçamento ${STATUS_CONFIG[filtroStatus as keyof typeof STATUS_CONFIG]?.label?.toLowerCase() ?? filtroStatus}`}
                      description="Crie o primeiro orçamento e acompanhe sua conversão em ordem de serviço."
                      actionLabel="Novo Orçamento"
                      onAction={() => nav(paths.orcamentoNovo)}
                      isFiltered={filtroStatus !== "todos"}
                      onClearFilter={() => setFiltroStatus("todos")}
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
        PaperProps={{ sx: { borderRadius: 2, minWidth: 180, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" } }}
      >
        {selectedOrcamento?.status !== "aprovado" && (
          <MenuItem onClick={handleAprovar} sx={{ gap: 1.5 }}>
            <CheckCircleOutlineRoundedIcon fontSize="small" color="success" />
            Aprovar
          </MenuItem>
        )}
        {selectedOrcamento?.status !== "recusado" && (
          <MenuItem onClick={() => handleConverterOS()} sx={{ gap: 1.5, fontWeight: 600, color: "primary.main" }}>
            <BuildRoundedIcon fontSize="small" />
            Converter em O.S.
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={handleWhatsApp} sx={{ gap: 1.5 }}>
          <WhatsAppIcon fontSize="small" sx={{ color: "#25D366" }} />
          Enviar WhatsApp
        </MenuItem>
        <MenuItem onClick={handlePrint} sx={{ gap: 1.5 }}>
          <PrintRoundedIcon fontSize="small" />
          Imprimir
        </MenuItem>
        <Divider />
        {selectedOrcamento?.status === "analise" && (
          <MenuItem onClick={handleRecusar} sx={{ gap: 1.5, color: "error.main" }}>
            <CancelRoundedIcon fontSize="small" color="error" />
            Recusar
          </MenuItem>
        )}
        <MenuItem onClick={handleExcluir} sx={{ gap: 1.5, color: "error.main" }}>
          <DeleteOutlineRoundedIcon fontSize="small" />
          Excluir
        </MenuItem>
      </Menu>

    </Box>
  );
}
