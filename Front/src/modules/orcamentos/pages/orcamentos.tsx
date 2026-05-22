import * as React from "react";
import {
  Box, Stack, Typography, Button,
  IconButton, Table, TableBody, TableCell, TableHead,
  TableRow, Menu, MenuItem, Fade, Chip, TablePagination,
  CircularProgress, Divider, ToggleButton, ToggleButtonGroup, Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import RequestQuoteRoundedIcon from "@mui/icons-material/RequestQuoteRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";

import { useToast } from "../../../context/ToastContext";
import { useConfirm } from "../../../context/ConfirmContext";
import DialogOrcamento from "../dialog";
import OrdemServicoDialog from "../../tarefas/dialog";
import api from "../../../api/api";
import ListTableContainer from "../../../components/common/ListTableContainer";
import EmptyState from "../../../components/common/EmptyState";
import { IllustrationOrcamentos } from "../../../components/common/Illustrations";

// ─── Tipos ─────────────────────────────────────────────────────────────────

type Orcamento = {
  id: number;
  descricao: string;
  valor: number;
  data: string;
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
  analise: { label: "Em análise", color: "#f59e0b", bg: alpha("#f59e0b", 0.1), chipColor: "warning" as const },
  aprovado: { label: "Aprovado", color: "#10b981", bg: alpha("#10b981", 0.1), chipColor: "success" as const },
  recusado: { label: "Recusado", color: "#ef4444", bg: alpha("#ef4444", 0.1), chipColor: "error" as const },
};

// ─── Componente ────────────────────────────────────────────────────────────

export default function OrcamentosPage() {
  const { success, error, warning } = useToast();
  const confirm = useConfirm();

  const [orcamentos, setOrcamentos] = React.useState<Orcamento[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [filtroStatus, setFiltroStatus] = React.useState<string>("todos");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [osDialogOpen, setOsDialogOpen] = React.useState(false);
  const [osInitial, setOsInitial] = React.useState<any>(null);
  const [convertingOrcamento, setConvertingOrcamento] = React.useState<Orcamento | null>(null);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  // ── Carrega ──
  const fetchData = React.useCallback(async () => {
    try {
      const res = await api.get("/orcamentos");
      setOrcamentos(res.data ?? []);
    } catch {
      setOrcamentos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

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
      setOrcamentos((p) => p.map((o) => o.id === selectedId ? { ...o, status: "aprovado" } : o));
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
      setOrcamentos((p) => p.map((o) => o.id === selectedId ? { ...o, status: "recusado" } : o));
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
      setOrcamentos((p) => p.filter((o) => o.id !== selectedId));
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

    setConvertingOrcamento(orcamento);
    setOsInitial({
      cliente_id: orcamento.cliente.id,
      veiculo_id: orcamento.veiculo.id,
      funcionario_id: 0,
      observacoes: `Convertido do orçamento #${orcamento.id}: ${orcamento.descricao}`,
      itens: itensOrcamento,
    });
    setOsDialogOpen(true);
  };

  const criarOSConvertida = async (payload: any) => {
    if (!convertingOrcamento) return;
    try {
      await api.post("/ordens", payload);
      await api.patch(`/orcamentos/${convertingOrcamento.id}/status`, { status: "aprovado" });
      setOrcamentos((p) => p.map((o) => o.id === convertingOrcamento.id ? { ...o, status: "aprovado" } : o));
      setOsDialogOpen(false);
      setOsInitial(null);
      setConvertingOrcamento(null);

      success(`O.S. criada com sucesso para ${convertingOrcamento.cliente?.nome}!`);
    } catch (err) {
      console.error("Erro ao converter em OS:", err);
      error("Não foi possível converter o orçamento em O.S.");
    }
  };

  const handleCloseOSDialog = () => {
    setOsDialogOpen(false);
    setOsInitial(null);
    setConvertingOrcamento(null);
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
  const criarOrcamento = async (data: any) => {
    try {
      const res = await api.post("/orcamentos", data);
      setOrcamentos((prev) => [res.data, ...prev]);
      success("Orçamento criado com sucesso!");
    } catch (err) {
      console.error(err);
      error("Não foi possível criar o orçamento.");
    }
  };

  // ── Filtros ──
  const filtered = React.useMemo(() => {
    return orcamentos.filter((o) => {
      const matchStatus = filtroStatus === "todos" || o.status === filtroStatus;
      const matchQuery = [o.cliente?.nome, o.veiculo?.modelo, o.veiculo?.placa, o.descricao]
        .join(" ").toLowerCase().includes(query.toLowerCase());
      return matchStatus && matchQuery;
    });
  }, [orcamentos, filtroStatus, query]);

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading) return <Box sx={{ textAlign: "center", mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4 } }}>

      {/* ── Header ── */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Stack spacing={0.3}>
          <Typography variant="h5" fontWeight={700}>Orçamentos</Typography>
          <Typography variant="body2" color="text.secondary">
            Controle de orçamentos, aprovações e conversão em O.S.
          </Typography>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => setDialogOpen(true)}
          disableElevation
          sx={{
            borderRadius: 999, textTransform: "none", fontWeight: 700, px: 2.5,
            background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.primary.dark})`,
          }}
        >
          Novo Orçamento
        </Button>
      </Stack>

      {/* ── Filtros ── */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mb={2.5} alignItems="center">
        <ToggleButtonGroup
          value={filtroStatus}
          exclusive
          onChange={(_, v) => { if (v !== null) { setFiltroStatus(v); setPage(0); } }}
          size="small"
          sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 600, px: 2, borderRadius: "999px !important", border: (t) => `1px solid ${t.palette.divider} !important`, mx: 0.25 } }}
        >
          <ToggleButton value="todos">Todos</ToggleButton>
          <ToggleButton value="analise" sx={{ "&.Mui-selected": { bgcolor: alpha("#f59e0b", 0.1), color: "#f59e0b" } }}>Em análise</ToggleButton>
          <ToggleButton value="aprovado" sx={{ "&.Mui-selected": { bgcolor: alpha("#10b981", 0.1), color: "#10b981" } }}>Aprovados</ToggleButton>
          <ToggleButton value="recusado" sx={{ "&.Mui-selected": { bgcolor: alpha("#ef4444", 0.1), color: "#ef4444" } }}>Recusados</ToggleButton>
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
                <TableCell>Status</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.length > 0 ? paginated.map((o) => {
                const st = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.analise;
                return (
                  <TableRow key={o.id} hover sx={{ height: 56 }}>
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
                          <Typography variant="caption" fontFamily="monospace" fontWeight={700}
                            sx={{ px: 0.75, py: 0.1, borderRadius: 0.75, bgcolor: (t) => alpha(t.palette.text.primary, 0.06), display: "inline-block", width: "fit-content" }}>
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
                      <Typography variant="body2" fontWeight={700} color="success.main">
                        R$ {Number(o.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </Typography>
                    </TableCell>

                    {/* Data */}
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(o.data).toLocaleDateString("pt-BR")}
                      </Typography>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Chip
                        label={st.label}
                        size="small"
                        color={st.chipColor}
                        sx={{ fontWeight: 700, fontSize: 11 }}
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
                      onAction={() => setDialogOpen(true)}
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
        count={filtered.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[5, 10, 20]}
        labelRowsPerPage="Linhas por página:"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `mais de ${to}`}`}
        sx={{ mt: 1.5, borderRadius: 2, bgcolor: "background.paper" }}
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
        {selectedOrcamento?.status === "analise" && (
          <MenuItem onClick={handleRecusar} sx={{ gap: 1.5 }}>
            <CancelRoundedIcon fontSize="small" color="error" />
            Recusar
          </MenuItem>
        )}
        {selectedOrcamento?.status !== "recusado" && (
          <MenuItem onClick={() => handleConverterOS()} sx={{ gap: 1.5, fontWeight: 600, color: "primary.main" }}>
            <BuildRoundedIcon fontSize="small" />
            Converter em O.S.
          </MenuItem>
        )}
        <MenuItem onClick={handleWhatsApp} sx={{ gap: 1.5 }}>
          <WhatsAppIcon fontSize="small" sx={{ color: "#25D366" }} />
          Enviar WhatsApp
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleExcluir} sx={{ gap: 1.5, color: "error.main" }}>
          <DeleteOutlineRoundedIcon fontSize="small" />
          Excluir
        </MenuItem>
      </Menu>

      {/* ── Dialog de criação ── */}
      <DialogOrcamento
        open={dialogOpen}
        mode="create"
        onClose={() => setDialogOpen(false)}
        onSubmit={criarOrcamento}
      />

      <OrdemServicoDialog
        open={osDialogOpen}
        mode="create"
        initial={osInitial}
        onClose={handleCloseOSDialog}
        onSubmit={criarOSConvertida}
      />
    </Box>
  );
}
