import React, { useEffect, useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, IconButton, Menu, MenuItem, Chip, Skeleton, Button,
  Dialog, DialogContent, DialogActions, TextField, CircularProgress, Alert,
  Select, FormControl, InputLabel, Checkbox, FormControlLabel, Divider,
  Tabs, Tab,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../../api/api";
import { TrocarEmailDialog } from "../../usuarios/dialog/TrocarEmail";
import { useToast } from "../../../context/ToastContext";
import { useConfirm } from "../../../context/ConfirmContext";

type Checklist = Record<string, boolean>;

type OficinaDetalhe = {
  id: number;
  nome: string;
  cnpj: string | null;
  logradouro: string;
  numero: string;
  complemento: string | null;
  cep: string;
  telefone: string | null;
  email: string | null;
  status_admin?: "implantacao" | "ativa" | "suspensa" | "cancelada";
  notas_internas?: string | null;
  implantacao_checklist?: Checklist;
  created_at: string;
  cidade: { nome: string; uf: string };
  gestor: { id: number; nome: string; email: string } | null;
  _count?: { clientes: number; veiculos: number; ordens_servico: number };
  acessos: {
    id: number;
    perfil: string;
    status: string;
    usuario: { id: number; nome: string; email: string; tipo: string; status: string; last_login_at?: string | null };
  }[];
};

type Historico = {
  id: number;
  action: string;
  message: string;
  created_at: string;
  actor?: { nome: string; email: string } | null;
};

const checklistLabels: Record<string, string> = {
  dados_completos: "Dados completos",
  gestor_criado: "Gestor criado",
  perfis_criados: "Perfis criados",
  primeiro_acesso: "Primeiro acesso feito",
  logo_cadastrada: "Logo cadastrada",
  usuarios_convidados: "Usuários convidados",
};

const statusLabels: Record<string, string> = {
  implantacao: "Implantação",
  ativa: "Ativa",
  suspensa: "Suspensa",
  cancelada: "Cancelada",
};

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.25 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 14 }}>{value || "—"}</Typography>
    </Box>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatDateOnly(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(value));
}

export function OficinaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error } = useToast();
  const confirm = useConfirm();

  const [oficina, setOficina] = useState<OficinaDetalhe | null>(null);
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; usuarioId: number } | null>(null);
  const [trocarEmailId, setTrocarEmailId] = useState<number | null>(null);
  const [resetDialog, setResetDialog] = useState<{ senha: string; email: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    nome: "", cnpj: "", logradouro: "", numero: "", cep: "", complemento: "", telefone: "", email: "",
    cidade: "", uf: "", gestor_usuario_id: "", status_admin: "ativa",
  });
  const [checklist, setChecklist] = useState<Checklist>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [notasValue, setNotasValue] = useState("");
  const [notasLoading, setNotasLoading] = useState(false);

  function hydrate(data: OficinaDetalhe) {
    setOficina(data);
    setChecklist(data.implantacao_checklist ?? {});
    setNotasValue(data.notas_internas ?? "");
    setEditForm({
      nome: data.nome ?? "",
      cnpj: data.cnpj ?? "",
      logradouro: data.logradouro ?? "",
      numero: data.numero ?? "",
      cep: data.cep ?? "",
      complemento: data.complemento ?? "",
      telefone: data.telefone ?? "",
      email: data.email ?? "",
      cidade: data.cidade?.nome ?? "",
      uf: data.cidade?.uf ?? "",
      gestor_usuario_id: data.gestor?.id ? String(data.gestor.id) : "",
      status_admin: data.status_admin ?? "ativa",
    });
  }

  function load() {
    setLoading(true);
    Promise.all([
      api.get<OficinaDetalhe>(`/oficinas/${id}`),
      api.get<Historico[]>(`/oficinas/${id}/historico`),
    ])
      .then(([detalhe, historicoResp]) => {
        hydrate(detalhe.data);
        setHistorico(historicoResp.data);
      })
      .catch(() => { error("Erro ao carregar oficina."); navigate("/oficinas"); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  async function handleResetSenha(usuarioId: number) {
    const usuario = oficina?.acessos.find((a) => a.usuario.id === usuarioId)?.usuario;
    const ok = await confirm({
      title: "Redefinir senha?",
      message: `Uma nova senha de 8 caracteres será gerada para ${usuario?.nome}. A senha atual deixará de funcionar imediatamente.`,
      confirmLabel: "Redefinir senha",
    });
    if (!ok) return;
    try {
      const { data } = await api.post(`/usuarios/${usuarioId}/reset-senha`);
      setResetDialog({ senha: data.senha, email: data.email });
      navigator.clipboard.writeText(data.senha).catch(() => {});
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
      load();
    } catch {
      error("Erro ao redefinir senha.");
    }
    setMenuAnchor(null);
  }

  function handleCopiar(value: string) {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  }

  async function handleSalvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    setEditErr("");
    setEditLoading(true);
    try {
      const payload = {
        ...editForm,
        gestor_usuario_id: editForm.gestor_usuario_id ? Number(editForm.gestor_usuario_id) : null,
        cnpj: editForm.cnpj || null,
        telefone: editForm.telefone || null,
        email: editForm.email || null,
        complemento: editForm.complemento || null,
        implantacao_checklist: checklist,
      };
      const { data } = await api.patch(`/oficinas/${id}`, payload);
      setEditOpen(false);
      hydrate({ ...oficina!, ...data, cidade: { nome: editForm.cidade, uf: editForm.uf } });
      load();
      success("Oficina atualizada com sucesso.");
    } catch (err: any) {
      setEditErr(err?.response?.data?.message ?? "Erro ao salvar alterações.");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleSalvarNotas() {
    setNotasLoading(true);
    try {
      await api.patch(`/oficinas/${id}`, { notas_internas: notasValue || null });
      load();
      success("Observações salvas com sucesso.");
    } catch {
      error("Erro ao salvar observações.");
    } finally {
      setNotasLoading(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Skeleton variant="text" width={200} height={32} />
        <Skeleton variant="rectangular" height={160} sx={{ mt: 2, borderRadius: 1 }} />
      </Box>
    );
  }

  if (!oficina) return null;

  const gestorOptions = oficina.acessos
    .filter((a) => a.usuario.tipo !== "sistema" && a.usuario.status === "ativo")
    .map((a) => a.usuario);

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <IconButton size="small" onClick={() => navigate("/oficinas")}>
            <ArrowBackRoundedIcon fontSize="small" />
          </IconButton>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="h6" fontWeight={700}>{oficina.nome}</Typography>
              <Chip label={statusLabels[oficina.status_admin ?? "ativa"]} size="small" />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {oficina.cidade.nome}/{oficina.cidade.uf}
            </Typography>
          </Box>
        </Box>
        <Button variant="outlined" size="small" startIcon={<EditRoundedIcon />} onClick={() => setEditOpen(true)}>
          Editar
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3, borderBottom: "1px solid", borderColor: "divider" }}>
        <Tab label="Geral" />
        <Tab label="Dados da Empresa" />
        <Tab label="Proprietário" />
        <Tab label="Observações" />
        <Tab label="Auditoria" />
        <Tab label="Usuários" />
      </Tabs>

      {/* Tab 0 — Geral */}
      {activeTab === 0 && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 2 }}>
          <Paper sx={{ p: 3 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", mb: 2 }}>
              Informações gerais
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 3 }}>
              <InfoRow label="Status" value={statusLabels[oficina.status_admin ?? "ativa"]} />
              <InfoRow label="Data de entrada" value={formatDateOnly(oficina.created_at)} />
              <InfoRow label="OS abertas" value={oficina._count?.ordens_servico ?? 0} />
              <InfoRow label="Clientes" value={oficina._count?.clientes ?? 0} />
              <InfoRow label="Veículos" value={oficina._count?.veiculos ?? 0} />
            </Box>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", mb: 2 }}>
              Checklist de implantação
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {Object.entries(checklistLabels).map(([key, label]) => (
                <Box key={key} sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                  <Typography sx={{ fontSize: 13 }}>{label}</Typography>
                  <Chip label={checklist[key] ? "OK" : "Pendente"} size="small" color={checklist[key] ? "success" : "default"} />
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      )}

      {/* Tab 1 — Dados da Empresa */}
      {activeTab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", mb: 2 }}>
            Dados da empresa
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 3 }}>
            <InfoRow label="Nome" value={oficina.nome} />
            <InfoRow label="CNPJ" value={oficina.cnpj} />
            <InfoRow label="Telefone" value={oficina.telefone} />
            <InfoRow label="E-mail" value={oficina.email} />
            <InfoRow label="CEP" value={oficina.cep} />
            <InfoRow label="Endereço" value={`${oficina.logradouro}, ${oficina.numero}${oficina.complemento ? ` — ${oficina.complemento}` : ""}`} />
            <InfoRow label="Cidade" value={`${oficina.cidade.nome}/${oficina.cidade.uf}`} />
          </Box>
        </Paper>
      )}

      {/* Tab 2 — Proprietário */}
      {activeTab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", mb: 2 }}>
            Proprietário / Gestor
          </Typography>
          {oficina.gestor ? (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 3 }}>
              <InfoRow label="Nome" value={oficina.gestor.nome} />
              <InfoRow label="E-mail" value={oficina.gestor.email} />
            </Box>
          ) : (
            <Typography sx={{ fontSize: 14, color: "text.secondary" }}>Nenhum gestor vinculado a esta oficina.</Typography>
          )}
        </Paper>
      )}

      {/* Tab 3 — Observações */}
      {activeTab === 3 && (
        <Paper sx={{ p: 3 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "text.secondary", mb: 2 }}>
            Observações internas
          </Typography>
          <TextField
            multiline
            minRows={6}
            fullWidth
            placeholder="Registre observações sobre este cliente..."
            value={notasValue}
            onChange={(e) => setNotasValue(e.target.value)}
          />
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
            <Button variant="contained" onClick={handleSalvarNotas} disabled={notasLoading}>
              {notasLoading ? <CircularProgress size={16} color="inherit" /> : "Salvar observações"}
            </Button>
          </Box>
        </Paper>
      )}

      {/* Tab 4 — Auditoria */}
      {activeTab === 4 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>Auditoria</Typography>
          {historico.length ? historico.map((item) => (
            <Box key={item.id} sx={{ py: 1.25, borderTop: "1px solid", borderColor: "divider" }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{item.message}</Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                {formatDate(item.created_at)} · {item.actor?.nome ?? "Sistema"}
              </Typography>
            </Box>
          )) : (
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Nenhum evento registrado ainda.</Typography>
          )}
        </Paper>
      )}

      {/* Tab 5 — Usuários */}
      {activeTab === 5 && (
        <>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
            Usuários ({oficina.acessos.length})
          </Typography>
          <Paper>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Nome</TableCell>
                    <TableCell>E-mail</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Último acesso</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {oficina.acessos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 5, color: "text.secondary", fontSize: 14 }}>
                        Nenhum usuário vinculado a esta oficina.
                      </TableCell>
                    </TableRow>
                  ) : (
                    oficina.acessos.map((acesso) => (
                      <TableRow key={acesso.id} hover>
                        <TableCell sx={{ fontWeight: 500 }}>{acesso.usuario.nome}</TableCell>
                        <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{acesso.usuario.email}</TableCell>
                        <TableCell><Chip label={acesso.usuario.tipo} size="small" /></TableCell>
                        <TableCell><Chip label={acesso.usuario.status === "ativo" ? "Ativo" : "Inativo"} size="small" /></TableCell>
                        <TableCell sx={{ color: "text.secondary", fontSize: 13 }}>{formatDate(acesso.usuario.last_login_at)}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setMenuAnchor({ el: e.currentTarget, usuarioId: acesso.usuario.id }); }}>
                            <MoreVertRoundedIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      {/* Context menu for users */}
      <Menu anchorEl={menuAnchor?.el} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => { setTrocarEmailId(menuAnchor!.usuarioId); setMenuAnchor(null); }}>
          Trocar e-mail
        </MenuItem>
        <MenuItem onClick={() => handleResetSenha(menuAnchor!.usuarioId)} sx={{ color: "text.secondary" }}>
          Redefinir senha
        </MenuItem>
      </Menu>

      <TrocarEmailDialog
        open={trocarEmailId !== null}
        usuarioId={trocarEmailId}
        onClose={() => setTrocarEmailId(null)}
        onSuccess={(uid, novoEmail) => {
          setOficina((prev) => prev ? {
            ...prev,
            acessos: prev.acessos.map((a) =>
              a.usuario.id === uid ? { ...a, usuario: { ...a.usuario, email: novoEmail } } : a
            ),
          } : prev);
          setTrocarEmailId(null);
          load();
          success("E-mail atualizado com sucesso.");
        }}
      />

      {/* Edit dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
        <Box sx={{ px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle1">Editar oficina</Typography>
        </Box>
        <Box component="form" onSubmit={handleSalvarEdicao}>
          <DialogContent sx={{ pt: 2.5 }}>
            {editErr && <Alert severity="error" sx={{ mb: 2 }}>{editErr}</Alert>}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
              <TextField label="Nome" value={editForm.nome} onChange={(e) => setEditForm((p) => ({ ...p, nome: e.target.value }))} required />
              <TextField label="CNPJ" value={editForm.cnpj} onChange={(e) => setEditForm((p) => ({ ...p, cnpj: e.target.value }))} />
              <TextField label="Logradouro" value={editForm.logradouro} onChange={(e) => setEditForm((p) => ({ ...p, logradouro: e.target.value }))} required />
              <TextField label="Número" value={editForm.numero} onChange={(e) => setEditForm((p) => ({ ...p, numero: e.target.value }))} required />
              <TextField label="CEP" value={editForm.cep} onChange={(e) => setEditForm((p) => ({ ...p, cep: e.target.value }))} required />
              <TextField label="Complemento" value={editForm.complemento} onChange={(e) => setEditForm((p) => ({ ...p, complemento: e.target.value }))} />
              <TextField label="Cidade" value={editForm.cidade} onChange={(e) => setEditForm((p) => ({ ...p, cidade: e.target.value }))} required />
              <TextField label="UF" value={editForm.uf} onChange={(e) => setEditForm((p) => ({ ...p, uf: e.target.value.toUpperCase().slice(0, 2) }))} required />
              <TextField label="Telefone" value={editForm.telefone} onChange={(e) => setEditForm((p) => ({ ...p, telefone: e.target.value }))} />
              <TextField label="E-mail da oficina" type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} />
              <FormControl>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={editForm.status_admin} onChange={(e) => setEditForm((p) => ({ ...p, status_admin: e.target.value }))}>
                  {Object.entries(statusLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl>
                <InputLabel>Gestor</InputLabel>
                <Select label="Gestor" value={editForm.gestor_usuario_id} onChange={(e) => setEditForm((p) => ({ ...p, gestor_usuario_id: e.target.value }))}>
                  <MenuItem value="">Sem gestor</MenuItem>
                  {gestorOptions.map((gestor) => <MenuItem key={gestor.id} value={String(gestor.id)}>{gestor.nome}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>Checklist de implantação</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1 }}>
              {Object.entries(checklistLabels).map(([key, label]) => (
                <FormControlLabel
                  key={key}
                  control={<Checkbox checked={!!checklist[key]} onChange={(e) => setChecklist((p) => ({ ...p, [key]: e.target.checked }))} />}
                  label={label}
                />
              ))}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button onClick={() => setEditOpen(false)} disabled={editLoading}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={editLoading}>
              {editLoading ? <CircularProgress size={16} color="inherit" /> : "Salvar"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={Boolean(resetDialog)} onClose={() => setResetDialog(null)} maxWidth="xs" fullWidth>
        <Box sx={{ px: 3, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle1">Senha redefinida</Typography>
        </Box>
        <DialogContent sx={{ pt: 2.5 }}>
          <Alert severity="success" sx={{ mb: 2 }}>
            Nova senha gerada para <strong>{resetDialog?.email}</strong>. Copie e repasse ao usuário.
          </Alert>
          <TextField
            value={resetDialog?.senha ?? ""}
            fullWidth
            InputProps={{
              readOnly: true,
              sx: { fontFamily: "monospace", fontSize: 20, letterSpacing: 2, textAlign: "center" },
            }}
          />
          {copiado && <Typography sx={{ fontSize: 12, color: "success.main", mt: 1 }}>Copiado para a área de transferência.</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => handleCopiar(resetDialog!.senha)}>
            Copiar senha
          </Button>
          <Button variant="contained" onClick={() => setResetDialog(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
