import React, { useEffect, useState } from "react";
import {
  Box, Typography, Button, Paper, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, IconButton, Menu, MenuItem,
  Chip, Skeleton,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import api from "../../../api/api";
import { CriarAdminDialog } from "../dialog/CriarAdmin";
import { useToast } from "../../../context/ToastContext";
import { useConfirm } from "../../../context/ConfirmContext";
import { useAuth } from "../../../context/AuthContext";

type Admin = {
  id: number;
  nome: string;
  email: string;
  status: string;
  created_at: string;
};

export function AdminsPage() {
  const [rows, setRows] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [criarOpen, setCriarOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; id: number } | null>(null);
  const { success, error } = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();

  useEffect(() => {
    api.get<Admin[]>("/admins")
      .then((r) => setRows(r.data))
      .catch(() => error("Erro ao carregar administradores."))
      .finally(() => setLoading(false));
  }, []);

  async function handleDesativar(id: number) {
    const admin = rows.find((a) => a.id === id);
    const ok = await confirm({
      title: "Desativar administrador?",
      message: `${admin?.nome} não conseguirá mais acessar o painel.`,
      confirmLabel: "Desativar",
    });
    if (!ok) return;
    try {
      await api.patch(`/admins/${id}/desativar`);
      setRows((prev) => prev.map((a) => a.id === id ? { ...a, status: "inativo" } : a));
      success("Administrador desativado.");
    } catch (err: any) {
      error(err?.response?.data?.message ?? "Erro ao desativar.");
    }
    setMenuAnchor(null);
  }

  async function handleReativar(id: number) {
    try {
      await api.patch(`/admins/${id}/reativar`);
      setRows((prev) => prev.map((a) => a.id === id ? { ...a, status: "ativo" } : a));
      success("Administrador reativado.");
    } catch {
      error("Erro ao reativar.");
    }
    setMenuAnchor(null);
  }

  const selectedAdmin = rows.find((a) => a.id === menuAnchor?.id);

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Administradores</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Usuários com acesso ao painel admin
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => setCriarOpen(true)}
        >
          Novo administrador
        </Button>
      </Box>

      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>E-mail</TableCell>
                <TableCell>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell key={j}><Skeleton variant="text" /></TableCell>
                    ))}
                  </TableRow>
                ))
                : rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {row.nome}
                      {row.id === user?.id && (
                        <Chip label="você" size="small" sx={{ ml: 1, fontSize: 10, height: 18, bgcolor: "#f3f4f6", color: "#374151" }} />
                      )}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{row.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={row.status === "ativo" ? "Ativo" : "Inativo"}
                        size="small"
                        sx={{
                          bgcolor: row.status === "ativo" ? "#f0fdf4" : "#f9fafb",
                          color: row.status === "ativo" ? "#16a34a" : "#6b7280",
                          fontWeight: 600, fontSize: 11,
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {row.id !== user?.id && (
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); setMenuAnchor({ el: e.currentTarget, id: row.id }); }}
                        >
                          <MoreVertRoundedIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              }
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 6, color: "text.secondary", fontSize: 14 }}>
                    Nenhum administrador cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Menu
        anchorEl={menuAnchor?.el}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        {selectedAdmin?.status === "ativo"
          ? <MenuItem onClick={() => handleDesativar(menuAnchor!.id)} sx={{ color: "error.main" }}>Desativar</MenuItem>
          : <MenuItem onClick={() => handleReativar(menuAnchor!.id)}>Reativar</MenuItem>
        }
      </Menu>

      <CriarAdminDialog
        open={criarOpen}
        onClose={() => setCriarOpen(false)}
        onSuccess={(novo) => {
          setRows((prev) => [...prev, novo]);
          setCriarOpen(false);
          success("Administrador criado com sucesso.");
        }}
      />
    </Box>
  );
}
