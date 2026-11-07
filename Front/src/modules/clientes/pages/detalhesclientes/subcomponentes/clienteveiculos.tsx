import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  Typography, Paper, Avatar, Box, Stack, Button, IconButton, Menu, MenuItem, Divider,
} from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import { paths } from "../../../../../routes/paths";
import { useToast } from "../../../../../context/ToastContext";
import { useConfirm } from "../../../../../context/ConfirmContext";
import VeiculoDialog, { type VeiculoForm } from "../../../../veiculos/dialog";
import { atualizarVeiculo, excluirVeiculo, mapVeiculo } from "../../../../veiculos/api/api";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";

export default function ClienteVeiculos({
  veiculos, cliente, onAdd, onChange,
}: {
  veiculos: any[];
  cliente?: { id: number; nome: string };
  onAdd?: () => void;
  onChange?: () => void;
}) {
  const nav = useNavigate();
  const { success, error } = useToast();
  const confirm = useConfirm();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selecionado, setSelecionado] = React.useState<any>(null);
  const [editando, setEditando] = React.useState(false);

  const fecharMenu = () => setAnchorEl(null);

  const novaOS = (v: any) =>
    nav(paths.ordemNova, { state: { cliente_id: cliente?.id, cliente, veiculo_id: Number(v.id) } });

  const excluir = async (v: any) => {
    fecharMenu();
    const ok = await confirm({
      title: "Excluir veículo?",
      message: "O histórico de ordens vinculado será mantido, mas o veículo será removido.",
      confirmLabel: "Sim, excluir",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await excluirVeiculo(String(v.id));
      success("Veículo excluído com sucesso.");
      onChange?.();
    } catch { error("Não foi possível excluir o veículo."); }
  };

  const salvarEdicao = async (data: VeiculoForm) => {
    try {
      await atualizarVeiculo(String(selecionado.id), data);
      setEditando(false);
      success("Veículo atualizado com sucesso!");
      onChange?.();
    } catch {
      error("Não foi possível salvar o veículo.");
    }
  };

  if (!veiculos?.length) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <DirectionsCarRoundedIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
        <Typography color="text.disabled">Nenhum veículo cadastrado</Typography>
        {onAdd && (
          <Button
            onClick={onAdd}
            startIcon={<AddRoundedIcon />}
            variant="contained"
            disableElevation
            sx={{ mt: 2, fontWeight: 700 }}
          >
            Veículo
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
            Veículo
          </Button>
        </Stack>
      )}
      <TableContainer component={Paper} elevation={0}
        sx={{ border: 0, borderRadius: 0 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Veículo</TableCell>
              <TableCell>Placa</TableCell>
              <TableCell>Ano</TableCell>
              <TableCell>Cor</TableCell>
              <TableCell align="right" aria-label="Ações" />
            </TableRow>
          </TableHead>
          <TableBody>
            {veiculos.map((v) => (
              <TableRow key={v.id} hover>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Avatar sx={{ bgcolor: (t) => t.palette.primary.main, width: 32, height: 32 }}>
                      <DirectionsCarRoundedIcon fontSize="small" />
                    </Avatar>
                    <Typography variant="body2" fontWeight={600}>{v.marca} {v.modelo}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={600}>{v.placa || "-"}</Typography>
                </TableCell>
                <TableCell>{v.ano || "-"}</TableCell>
                <TableCell>{v.cor || "-"}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    {cliente && (
                      <Button
                        size="small" variant="text" color="primary" onClick={() => novaOS(v)}
                        sx={{ fontWeight: 700, letterSpacing: 0.6, px: 1.75, whiteSpace: "nowrap" }}
                      >
                        NOVA OS
                      </Button>
                    )}
                    <IconButton
                      size="small" aria-label="Mais ações"
                      onClick={(e) => { setAnchorEl(e.currentTarget); setSelecionado(v); }}
                    >
                      <MoreVertRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Menu
        anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={fecharMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={() => nav(`/veiculos/${selecionado?.id}`)}>Ver detalhes</MenuItem>
        {cliente && <MenuItem onClick={() => novaOS(selecionado)}>Nova OS</MenuItem>}
        <MenuItem onClick={() => { fecharMenu(); setEditando(true); }}>Editar</MenuItem>
        <Divider />
        <MenuItem onClick={() => excluir(selecionado)} sx={{ color: "error.main" }}>Excluir</MenuItem>
      </Menu>

      <VeiculoDialog
        open={editando}
        mode="edit"
        initial={selecionado ? mapVeiculo(selecionado) : null}
        onClose={() => setEditando(false)}
        onSubmit={salvarEdicao}
      />
    </Stack>
  );
}
