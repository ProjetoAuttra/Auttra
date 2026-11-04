import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Typography, Paper, Chip, Box, Stack, Button, IconButton, Menu, MenuItem, Divider,
} from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import { useToast } from "../../../../../context/ToastContext";
import { useConfirm } from "../../../../../context/ConfirmContext";
import { excluirOrdem, mudarStatusOrdem } from "../../../../tarefas/api/api";
import { VALID_TRANSITIONS, podeEditarOrdem, type OrdemStatus } from "../../../../tarefas/statusConfig";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";

const STATUS_OS: Record<string, { label: string; color: "warning" | "info" | "success" | "error" }> = {
  aberta: { label: "Aberta", color: "warning" },
  em_andamento: { label: "Em andamento", color: "info" },
  concluida: { label: "Concluída", color: "success" },
  cancelada: { label: "Cancelada", color: "error" },
};

const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_CONFIRM: Record<string, { title: string; confirmLabel: string; variant: "danger" | "info" }> = {
  em_andamento: { title: "Iniciar atendimento desta OS?", confirmLabel: "Sim, iniciar", variant: "info" },
  concluida: { title: "Concluir esta OS?", confirmLabel: "Sim, concluir e gerar cobrança", variant: "info" },
  cancelada: { title: "Cancelar esta OS?", confirmLabel: "Sim, cancelar OS", variant: "danger" },
};

// Ação principal da linha, como o RECEBER nos pagamentos: o próximo passo natural da OS.
const PROXIMO_PASSO: Partial<Record<OrdemStatus, { label: string; status: OrdemStatus }>> = {
  aberta: { label: "INICIAR", status: "em_andamento" },
  em_andamento: { label: "CONCLUIR", status: "concluida" },
};

export default function ClienteOrdens({
  ordens, onAdd, onChange,
}: { ordens: any[]; onAdd?: () => void; onChange?: () => void }) {
  const nav = useNavigate();
  const { success, error } = useToast();
  const confirm = useConfirm();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selecionada, setSelecionada] = React.useState<any>(null);

  const fecharMenu = () => setAnchorEl(null);

  const mudarStatus = async (os: any, novo: OrdemStatus) => {
    fecharMenu();
    const cfg = STATUS_CONFIRM[novo];
    const message =
      novo === "concluida"
        ? Number(os.valor_total ?? 0) > 0
          ? `Isso vai gerar automaticamente uma cobrança de ${brl(Number(os.valor_total))} em Contas a Receber.`
          : "Confirma a conclusão desta OS?"
        : novo === "cancelada" ? "Esta ação não pode ser desfeita." : undefined;
    if (!(await confirm({ title: cfg.title, message, confirmLabel: cfg.confirmLabel, variant: cfg.variant }))) return;
    try {
      const atualizada = await mudarStatusOrdem(os.id, novo);
      success(
        novo === "concluida" && Number(atualizada.valor_total) > 0
          ? "OS concluída! Cobrança gerada automaticamente em Contas a Receber."
          : "Situação da OS atualizada com sucesso!",
      );
      onChange?.();
    } catch (err: any) {
      error(err?.response?.data?.error ?? err?.response?.data?.message ?? "Não foi possível atualizar a situação da OS.");
    }
  };

  const excluir = async (os: any) => {
    fecharMenu();
    const ok = await confirm({
      title: "Excluir ordem de serviço?", message: "Esta ação não pode ser desfeita.",
      confirmLabel: "Sim, excluir", variant: "danger",
    });
    if (!ok) return;
    try {
      await excluirOrdem(os.id);
      success("Ordem excluída com sucesso.");
      onChange?.();
    } catch { error("Não foi possível excluir a ordem."); }
  };

  if (!ordens?.length) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <AssignmentRoundedIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
        <Typography color="text.disabled">Nenhuma ordem de serviço encontrada</Typography>
        {onAdd && (
          <Button
            onClick={onAdd}
            startIcon={<AddRoundedIcon />}
            variant="contained"
            disableElevation
            sx={{ mt: 2, fontWeight: 700 }}
          >
            Nova OS
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Stack spacing={1.5}>
      {onAdd && (
        <Stack direction="row" justifyContent="flex-end">
          <Button onClick={onAdd} startIcon={<AddRoundedIcon />} variant="contained" disableElevation sx={{ fontWeight: 700 }}>
            Nova OS
          </Button>
        </Stack>
      )}
      <TableContainer component={Paper} elevation={0}
        sx={{ border: 0, borderRadius: 0 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Veículo</TableCell>
              <TableCell>Mecânico</TableCell>
              <TableCell>Data</TableCell>
              <TableCell>Total</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell align="right" aria-label="Ações" />
            </TableRow>
          </TableHead>
          <TableBody>
            {ordens.map((o) => {
              const st = STATUS_OS[o.status] ?? STATUS_OS.aberta;
              return (
                <TableRow key={o.id} hover>
                  <TableCell>
                    <Typography variant="body2">
                      {o.veiculo ? `${o.veiculo.marca} ${o.veiculo.modelo}` : "-"}
                    </Typography>
                    {o.veiculo?.placa && (
                      <Typography variant="caption" fontFamily="monospace" fontWeight={600}
                        sx={{ px: 0.5, borderRadius: 1, bgcolor: (t) => t.palette.action.hover }}>
                        {o.veiculo.placa}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{o.funcionario?.nome ?? "-"}</TableCell>
                  <TableCell>
                    {o.data_abertura ? new Date(o.data_abertura).toLocaleDateString("pt-BR") : "-"}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} color="success.main">
                      {brl(o.valor_total ?? 0)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={st.label} size="small" color={st.color} sx={{ fontWeight: 600, fontSize: 12 }} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      {PROXIMO_PASSO[o.status as OrdemStatus] && (
                        <Button
                          size="small" variant="text" color="primary"
                          onClick={() => mudarStatus(o, PROXIMO_PASSO[o.status as OrdemStatus]!.status)}
                          sx={{ fontWeight: 700, letterSpacing: 0.6, px: 1.75 }}
                        >
                          {PROXIMO_PASSO[o.status as OrdemStatus]!.label}
                        </Button>
                      )}
                      <IconButton
                        size="small" aria-label="Mais ações"
                        onClick={(e) => { setAnchorEl(e.currentTarget); setSelecionada(o); }}
                      >
                        <MoreVertRoundedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Menu
        anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={fecharMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={() => nav(`/ordens/${selecionada?.id}`)}>Ver detalhes</MenuItem>
        {podeEditarOrdem(selecionada?.status) && (
          <MenuItem onClick={() => nav(`/ordens/${selecionada?.id}/editar`)}>Editar</MenuItem>
        )}
        {(VALID_TRANSITIONS[(selecionada?.status as OrdemStatus) ?? "aberta"] ?? []).length > 0 && <Divider />}
        {(VALID_TRANSITIONS[(selecionada?.status as OrdemStatus) ?? "aberta"] ?? []).includes("em_andamento") && (
          <MenuItem onClick={() => mudarStatus(selecionada, "em_andamento")}>Iniciar atendimento</MenuItem>
        )}
        {(VALID_TRANSITIONS[(selecionada?.status as OrdemStatus) ?? "aberta"] ?? []).includes("concluida") && (
          <MenuItem onClick={() => mudarStatus(selecionada, "concluida")}>Concluir OS</MenuItem>
        )}
        {(VALID_TRANSITIONS[(selecionada?.status as OrdemStatus) ?? "aberta"] ?? []).includes("cancelada") && (
          <MenuItem onClick={() => mudarStatus(selecionada, "cancelada")} sx={{ color: "error.main" }}>Cancelar OS</MenuItem>
        )}
        <Divider />
        <MenuItem onClick={() => excluir(selecionada)} sx={{ color: "error.main" }}>Excluir</MenuItem>
      </Menu>
    </Stack>
  );
}
