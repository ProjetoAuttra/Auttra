import * as React from "react";
import {
  Box,
  Stack,
  Typography,
  Paper,
  Divider,
  Chip,
  Button,
  Grid,
  IconButton,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../../../api/api";
import { alpha } from "@mui/material/styles";
import OrdemServicoDialog from "../../dialog";
import { atualizarOrdem, mudarStatusOrdem } from "../../api/api";
import { STATUS_CONFIG, VALID_TRANSITIONS, type OrdemStatus } from "../../statusConfig";
import { useToast } from "../../../../context/ToastContext";
import { useConfirm } from "../../../../context/ConfirmContext";

export default function OrdemServicoDetalhes() {
  const { id } = useParams();
  const nav = useNavigate();
  const { success, error } = useToast();
  const confirm = useConfirm();
  const [ordem, setOrdem] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [openEdit, setOpenEdit] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);
  const [mudandoStatus, setMudandoStatus] = React.useState(false);

  const toNumber = (v: any): number => {
    if (v == null) return 0;
    if (typeof v === "object" && typeof v.toNumber === "function")
      return v.toNumber();
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const money = (v: any): string =>
    toNumber(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  React.useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/ordens/${id}`);
        setOrdem(res.data);
      } catch (err) {
        console.error("Erro ao carregar OS:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handlePrint = async () => {
    if (!id) return;
    const pdfWindow = window.open("", "_blank");
    if (!pdfWindow) {
      error("O navegador bloqueou a abertura do PDF. Libere pop-ups para imprimir a OS.");
      return;
    }

    setPrinting(true);
    try {
      pdfWindow.document.write("<p>Gerando PDF da OS...</p>");
      const res = await api.get(`/ordens/${id}/pdf`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      pdfWindow.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      console.error("Erro ao gerar PDF da OS:", err);
      pdfWindow.close();
      error("Não foi possível gerar o PDF da OS.");
    } finally {
      setPrinting(false);
    }
  };

  const CONFIRM_CONFIG: Record<
    string,
    { title: string; confirmLabel: string; variant: "danger" | "warning" | "info" }
  > = {
    em_andamento: {
      title: "Iniciar atendimento desta OS?",
      confirmLabel: "Sim, iniciar",
      variant: "info",
    },
    concluida: {
      title: "Concluir esta OS?",
      confirmLabel: "Sim, concluir e gerar cobrança",
      variant: "info",
    },
    cancelada: {
      title: "Cancelar esta OS?",
      confirmLabel: "Sim, cancelar OS",
      variant: "danger",
    },
  };

  const handleMudarStatus = async (novoStatus: OrdemStatus) => {
    if (!id) return;
    const cfg = CONFIRM_CONFIG[novoStatus];
    const message =
      novoStatus === "concluida"
        ? toNumber(ordem?.valor_total) > 0
          ? `Isso vai gerar automaticamente uma cobrança de ${money(ordem.valor_total)} em Contas a Receber.`
          : "Confirma a conclusão desta OS?"
        : novoStatus === "cancelada"
        ? "Esta ação não pode ser desfeita."
        : undefined;
    const ok = await confirm({
      title: cfg.title,
      message,
      confirmLabel: cfg.confirmLabel,
      variant: cfg.variant,
    });
    if (!ok) return;

    setMudandoStatus(true);
    try {
      const atualizada = await mudarStatusOrdem(Number(id), novoStatus);
      setOrdem(atualizada);
      if (novoStatus === "concluida" && toNumber(atualizada.valor_total) > 0) {
        success("OS concluída! Cobrança gerada automaticamente em Contas a Receber.");
      } else {
        success("Status da OS atualizado com sucesso!");
      }
    } catch (err: any) {
      error(
        err?.response?.data?.error ??
          err?.response?.data?.message ??
          "Não foi possível atualizar o status da OS."
      );
    } finally {
      setMudandoStatus(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 6, textAlign: "center" }}>
        <Typography color="text.secondary">Carregando OS...</Typography>
      </Box>
    );
  }

  if (!ordem) {
    return (
      <Box sx={{ p: 6, textAlign: "center" }}>
        <Typography color="text.secondary">
          Ordem de Serviço não encontrada.
        </Typography>
        <Button
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => nav(-1)}
          sx={{ mt: 2 }}
        >
          Voltar
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        maxWidth: 1200,
        mx: "auto",
        p: { xs: 2, sm: 3, md: 4 },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        mb={3}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton onClick={() => nav(-1)}>
            <ArrowBackRoundedIcon />
          </IconButton>
          <Typography variant="h5" fontWeight={700}>
            Ordem #{ordem.id}
          </Typography>
        </Stack>

        <Chip
          label={(STATUS_CONFIG[ordem.status as OrdemStatus] ?? STATUS_CONFIG.aberta).label}
          color={(STATUS_CONFIG[ordem.status as OrdemStatus] ?? STATUS_CONFIG.aberta).color}
          sx={{ fontWeight: 700 }}
        />
      </Stack>

      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 3,
          border: (t) => `1px solid ${t.palette.divider}`,
        }}
      >
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Cliente
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {ordem.cliente?.nome ?? "-"}
            </Typography>
            {ordem.cliente?.telefone && (
              <Typography variant="body2" color="text.secondary">
                {ordem.cliente.telefone}
              </Typography>
            )}
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Veículo
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {ordem.veiculo
                ? `${ordem.veiculo.marca} ${ordem.veiculo.modelo} (${ordem.veiculo.placa})`
                : "-"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ano {ordem.veiculo?.ano ?? "-"}
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Funcionário responsável
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {ordem.funcionario?.nome ?? "-"}
            </Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2.5 }} />

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
          Observações
        </Typography>
        <Typography variant="body2">
          {ordem.observacoes?.trim()
            ? ordem.observacoes
            : "Nenhuma observação registrada."}
        </Typography>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 3,
          border: (t) => `1px solid ${t.palette.divider}`,
        }}
      >
        <Typography variant="h6" fontWeight={700} mb={2}>
          Itens
        </Typography>

        {(ordem.itens ?? []).length ? (
          (ordem.itens ?? []).map((item: any, i: number) => (
            <Stack
              key={i}
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              sx={{
                p: 1.5,
                borderRadius: 2,
                mb: 1,
                bgcolor: (t) => alpha(t.palette.primary.main, 0.02),
              }}
            >
              <Stack spacing={0.2}>
                <Typography fontWeight={600}>
                  {item.tipo_item === "peca"
                    ? item.peca?.nome ?? "Peça"
                    : item.servico?.nome ?? "Serviço"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {`${item.quantidade}x ${money(item.preco_unitario)}`}
                </Typography>
              </Stack>
              <Typography fontWeight={700}>{money(item.subtotal)}</Typography>
            </Stack>
          ))
        ) : (
          <Typography color="text.secondary">Nenhum item adicionado.</Typography>
        )}

        <Divider sx={{ my: 2 }} />

        <Stack direction="row" justifyContent="flex-end">
          <Typography variant="h6" fontWeight={800}>
            Total: {money(ordem.valor_total)}
          </Typography>
        </Stack>
      </Paper>

      <Stack direction="row" justifyContent="flex-end" spacing={1} flexWrap="wrap" useFlexGap>
        <Button variant="outlined" onClick={() => nav("/tarefas")}>
          Voltar
        </Button>
        <Button
          variant="outlined"
          startIcon={<PrintRoundedIcon />}
          onClick={handlePrint}
          disabled={printing}
        >
          Imprimir OS
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setOpenEdit(true)}
        >
          Editar OS
        </Button>

        {(VALID_TRANSITIONS[ordem.status as OrdemStatus] ?? []).includes("cancelada") && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<CancelRoundedIcon />}
            onClick={() => handleMudarStatus("cancelada")}
            disabled={mudandoStatus}
          >
            Cancelar OS
          </Button>
        )}

        {(VALID_TRANSITIONS[ordem.status as OrdemStatus] ?? []).includes("em_andamento") && (
          <Button
            variant="contained"
            color="info"
            disableElevation
            startIcon={<PlayArrowRoundedIcon />}
            onClick={() => handleMudarStatus("em_andamento")}
            disabled={mudandoStatus}
          >
            Iniciar Atendimento
          </Button>
        )}

        {(VALID_TRANSITIONS[ordem.status as OrdemStatus] ?? []).includes("concluida") && (
          <Button
            variant="contained"
            color="success"
            disableElevation
            startIcon={<CheckCircleRoundedIcon />}
            onClick={() => handleMudarStatus("concluida")}
            disabled={mudandoStatus}
          >
            Concluir OS
          </Button>
        )}
      </Stack>

      <OrdemServicoDialog
        open={openEdit}
        mode="edit"
        initial={ordem}
        onClose={() => setOpenEdit(false)}
        onSubmit={async (payload) => {
          try {
            const atualizada = await atualizarOrdem(Number(id), payload);
            setOrdem(atualizada);
            setOpenEdit(false);
            success("OS atualizada com sucesso!");
          } catch {
            error("Não foi possível atualizar a OS.");
          }
        }}
      />
    </Box>
  );
}
