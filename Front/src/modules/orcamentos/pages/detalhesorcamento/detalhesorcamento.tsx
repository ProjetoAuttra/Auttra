import * as React from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import RequestQuoteRoundedIcon from "@mui/icons-material/RequestQuoteRounded";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../../../api/api";
import { useToast } from "../../../../context/ToastContext";

type OrcamentoItem = {
  id: number | string;
  tipo_item: "servico" | "peca";
  nome?: string | null;
  servico?: { nome: string } | null;
  peca?: { nome: string } | null;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
};

type Orcamento = {
  id: number;
  descricao?: string | null;
  valor: number;
  data: string;
  validade?: string | null;
  status: "analise" | "aprovado" | "recusado";
  cliente?: { id: number; nome: string; telefone?: string; email?: string; cpf?: string } | null;
  veiculo?: { id: number; marca?: string; modelo?: string; placa?: string; ano?: number } | null;
  itens?: OrcamentoItem[];
};

const STATUS_CONFIG: Record<Orcamento["status"], { label: string; color: "warning" | "success" | "error" }> = {
  analise: { label: "Em análise", color: "warning" },
  aprovado: { label: "Aprovado", color: "success" },
  recusado: { label: "Recusado", color: "error" },
};

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function date(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "-";
}

function itemName(item: OrcamentoItem) {
  return item.nome ?? item.servico?.nome ?? item.peca?.nome ?? "Item do orçamento";
}

export default function OrcamentoDetalhes() {
  const { id } = useParams();
  const nav = useNavigate();
  const { error } = useToast();
  const [orcamento, setOrcamento] = React.useState<Orcamento | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [printing, setPrinting] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get(`/orcamentos/${id}`);
        if (active) setOrcamento(data);
      } catch (err) {
        console.error("Erro ao carregar orçamento:", err);
        if (active) setOrcamento(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  const handlePrint = async () => {
    if (!id) return;
    const pdfWindow = window.open("", "_blank");
    if (!pdfWindow) {
      error("O navegador bloqueou a abertura do PDF. Libere pop-ups para imprimir o orçamento.");
      return;
    }

    setPrinting(true);
    try {
      pdfWindow.document.write("<p>Gerando PDF do orçamento...</p>");
      const res = await api.get(`/orcamentos/${id}/pdf`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      pdfWindow.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      console.error("Erro ao imprimir orçamento:", err);
      pdfWindow.close();
      error("Não foi possível gerar o PDF do orçamento.");
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 6, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!orcamento) {
    return (
      <Box sx={{ p: 6, textAlign: "center" }}>
        <Typography color="text.secondary">Orçamento não encontrado.</Typography>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => nav("/orcamentos")} sx={{ mt: 2 }}>
          Voltar
        </Button>
      </Box>
    );
  }

  const status = STATUS_CONFIG[orcamento.status] ?? STATUS_CONFIG.analise;
  const itens = orcamento.itens ?? [];

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} gap={2}>
        <Stack direction="row" spacing={1.5} alignItems="center" minWidth={0}>
          <IconButton onClick={() => nav("/orcamentos")} size="small" sx={{ bgcolor: "action.hover", borderRadius: 2 }}>
            <ArrowBackRoundedIcon fontSize="small" />
          </IconButton>
          <Stack minWidth={0}>
            <Typography variant="h5" fontWeight={800} noWrap>
              Orçamento #{orcamento.id}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {orcamento.cliente?.nome ?? "Cliente não informado"}
            </Typography>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label={status.label} color={status.color} sx={{ fontWeight: 700 }} />
          <Button
            variant="contained"
            startIcon={<PrintRoundedIcon />}
            onClick={handlePrint}
            disabled={printing}
            disableElevation
            sx={{ borderRadius: 999, fontWeight: 700 }}
          >
            Imprimir
          </Button>
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: (t) => `1px solid ${t.palette.divider}` }}>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
              <PersonRoundedIcon color="action" fontSize="small" />
              <Typography variant="subtitle2" color="text.secondary">Cliente</Typography>
            </Stack>
            <Typography fontWeight={700}>{orcamento.cliente?.nome ?? "-"}</Typography>
            {orcamento.cliente?.telefone && <Typography variant="body2" color="text.secondary">{orcamento.cliente.telefone}</Typography>}
            {orcamento.cliente?.email && <Typography variant="body2" color="text.secondary">{orcamento.cliente.email}</Typography>}
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
              <DirectionsCarRoundedIcon color="action" fontSize="small" />
              <Typography variant="subtitle2" color="text.secondary">Veículo</Typography>
            </Stack>
            <Typography fontWeight={700}>
              {[orcamento.veiculo?.marca, orcamento.veiculo?.modelo].filter(Boolean).join(" ") || "-"}
            </Typography>
            {orcamento.veiculo?.placa && <Typography variant="body2" color="text.secondary">Placa {orcamento.veiculo.placa}</Typography>}
            {orcamento.veiculo?.ano && <Typography variant="body2" color="text.secondary">Ano {orcamento.veiculo.ano}</Typography>}
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
              <RequestQuoteRoundedIcon color="action" fontSize="small" />
              <Typography variant="subtitle2" color="text.secondary">Datas</Typography>
            </Stack>
            <Typography variant="body2">Criado em {date(orcamento.data)}</Typography>
            <Typography variant="body2" color="text.secondary">Válido até {date(orcamento.validade)}</Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2.5 }} />

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
          Descrição
        </Typography>
        <Typography variant="body2">
          {orcamento.descricao?.trim() ? orcamento.descricao : "Sem descrição informada."}
        </Typography>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: (t) => `1px solid ${t.palette.divider}` }}>
        <Typography variant="h6" fontWeight={800} mb={2}>Itens</Typography>

        {itens.length ? (
          <Stack spacing={1}>
            {itens.map((item) => (
              <Stack
                key={item.id}
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
                sx={{ p: 1.5, borderRadius: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.03) }}
              >
                <Stack spacing={0.25}>
                  <Typography fontWeight={700}>{itemName(item)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.tipo_item === "peca" ? "Peça" : "Mão de obra"} • {item.quantidade}x {money(item.preco_unitario)}
                  </Typography>
                </Stack>
                <Typography fontWeight={800}>{money(item.subtotal)}</Typography>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary">Nenhum item adicionado.</Typography>
        )}

        <Divider sx={{ my: 2 }} />
        <Stack direction="row" justifyContent="flex-end">
          <Typography variant="h6" fontWeight={900}>
            Total: {money(orcamento.valor)}
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
