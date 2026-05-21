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
import { useNavigate, useParams } from "react-router-dom";
import api from "../../../../api/api";
import { alpha } from "@mui/material/styles";
import OrdemServicoDialog from "../../dialog";
import { atualizarOrdem } from "../../api/api";
import { useToast } from "../../../../context/ToastContext";

export default function OrdemServicoDetalhes() {
  const { id } = useParams();
  const nav = useNavigate();
  const { success, error } = useToast();
  const [ordem, setOrdem] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [openEdit, setOpenEdit] = React.useState(false);

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
          label={ordem.status?.toUpperCase() ?? "ABERTA"}
          color={
            ordem.status === "fechada"
              ? "success"
              : ordem.status === "cancelada"
              ? "error"
              : "warning"
          }
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

      <Stack direction="row" justifyContent="flex-end" spacing={1}>
        <Button variant="outlined" onClick={() => nav("/tarefas")}>
          Voltar
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setOpenEdit(true)}
        >
          Editar OS
        </Button>
        <Button
            variant="outlined"
            onClick={() => window.open(`${api.defaults.baseURL}/ordens/${id}/pdf`, "_blank")}
            >
            Imprimir OS
        </Button>
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
