import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogActions,
    Stack,
    TextField,
    Button,
    IconButton,
    Typography,
    Paper,
    Grid,
    InputAdornment,
    MenuItem,
    Divider,
    Collapse,
    Alert,
    Box,
    CircularProgress,
} from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import RequestQuoteRoundedIcon from "@mui/icons-material/RequestQuoteRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import DirectionsCarRoundedIcon from "@mui/icons-material/DirectionsCarRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import CalendarTodayRoundedIcon from "@mui/icons-material/CalendarTodayRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import api from "../../../api/api";
import { useAuth } from "../../../context/AuthContext";

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type OrcamentoForm = {
    clienteId: number;
    veiculoId: number;
    descricao: string;
    valor: number;
    data: string;
    itens: OrcamentoItem[];
};

export type OrcamentoItem = {
    id: string | number;
    tipo_item: "servico" | "peca";
    nome: string;
    servico_id?: number | null;
    peca_id?: number | null;
    quantidade: number;
    preco_unitario: number;
    subtotal: number;
};

export type Orcamento = {
    id: number;
    descricao: string;
    valor: number;
    data: string;
    status: "analise" | "aprovado" | "recusado";
    cliente: { id: number; nome: string };
    veiculo: { id: number; modelo: string; placa: string };
    itens?: OrcamentoItem[];
};

type Props = {
    open: boolean;
    mode: "create" | "edit";
    initial?: Orcamento | null;
    onClose: () => void;
    onSubmit: (data: OrcamentoForm) => void;
    onDelete?: (item: Orcamento) => void;
};

// ─── Utilitários ──────────────────────────────────────────────────────────

function formatPreco(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    const num = parseFloat(digits) / 100;
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parsePreco(formatted: string): number {
    return parseFloat(formatted.replace(/\./g, "").replace(",", ".")) || 0;
}

// ─── Styled ────────────────────────────────────────────────────────────────

const HeaderIcon = styled(Box)(({ theme }) => ({
    width: 38,
    height: 38,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
    color: "#fff",
    flexShrink: 0,
    boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.35)}`,
    "& svg": { fontSize: 20 },
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.palette.text.disabled,
    marginBottom: theme.spacing(1.5),
}));

// ─── Componente ────────────────────────────────────────────────────────────

export default function DialogOrcamento({
    open,
    mode,
    initial,
    onClose,
    onSubmit,
    onDelete,
}: Props) {
    const { user } = useAuth();
    const isEdit = mode === "edit";

    // Dados
    const [clientes, setClientes] = React.useState<{ id: number; nome: string }[]>([]);
    const [veiculos, setVeiculos] = React.useState<{ id: number; modelo: string; placa: string }[]>([]);
    const [servicos, setServicos] = React.useState<any[]>([]);
    const [pecas, setPecas] = React.useState<any[]>([]);
    const [loadingVeiculos, setLoadingVeiculos] = React.useState(false);

    // Campos
    const [clienteId, setClienteId] = React.useState<number>(0);
    const [veiculoId, setVeiculoId] = React.useState<number>(0);
    const [descricao, setDescricao] = React.useState("");
    const [precoFormatado, setPrecoFormatado] = React.useState("");
    const [data, setData] = React.useState(new Date().toISOString().split("T")[0]);
    const [itens, setItens] = React.useState<OrcamentoItem[]>([]);
    const [selecaoAberta, setSelecaoAberta] = React.useState<null | "servico" | "peca">(null);
    const [selecionadoId, setSelecionadoId] = React.useState<number>(0);

    // UI
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [submitAttempted, setSubmitAttempted] = React.useState(false);
    const [confirmDelete, setConfirmDelete] = React.useState(false);

    // ── Carrega clientes ao abrir ──
    React.useEffect(() => {
        if (!open || !user?.oficina_id) return;
        api.get(`/clientes?oficina_id=${user.oficina_id}`)
            .then((res) => setClientes(res.data.map((c: any) => ({ id: c.id, nome: c.nome }))))
            .catch(() => setClientes([]));
    }, [open, user?.oficina_id]);

    React.useEffect(() => {
        if (!open || !user?.oficina_id) return;
        Promise.all([
            api.get(`/servicos?oficina_id=${user.oficina_id}`),
            api.get(`/pecas?oficina_id=${user.oficina_id}`),
        ])
            .then(([serv, pec]) => {
                setServicos(serv.data ?? []);
                setPecas(pec.data ?? []);
            })
            .catch(() => {
                setServicos([]);
                setPecas([]);
            });
    }, [open, user?.oficina_id]);

    // ── Carrega veículos quando cliente muda ──
    React.useEffect(() => {
        if (!clienteId) { setVeiculos([]); setVeiculoId(0); return; }
        setLoadingVeiculos(true);
        api.get(`/veiculos?cliente_id=${clienteId}`)
            .then((res) => setVeiculos(res.data.map((v: any) => ({ id: v.id, modelo: v.modelo, placa: v.placa }))))
            .catch(() => setVeiculos([]))
            .finally(() => setLoadingVeiculos(false));
    }, [clienteId]);

    // ── Reset ao abrir ──
    React.useEffect(() => {
        if (!open) return;
        setClienteId(initial?.cliente?.id ?? (initial as any)?.cliente_id ?? 0);
        setVeiculoId(initial?.veiculo?.id ?? (initial as any)?.veiculo_id ?? 0);
        setDescricao(initial?.descricao ?? "");
        setPrecoFormatado(
            initial?.valor
                ? Number(initial.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                : ""
        );
        setData(initial?.data ? initial.data.split("T")[0] : new Date().toISOString().split("T")[0]);
        setItens((initial?.itens ?? []).map((i: any) => ({
            id: i.id,
            tipo_item: i.tipo_item,
            nome: i.nome ?? i.servico?.nome ?? i.peca?.nome ?? "Item",
            servico_id: i.servico_id ?? i.servico?.id ?? null,
            peca_id: i.peca_id ?? i.peca?.id ?? null,
            quantidade: Number(i.quantidade ?? 1),
            preco_unitario: Number(i.preco_unitario ?? 0),
            subtotal: Number(i.subtotal ?? 0),
        })));
        setErrors({});
        setSubmitAttempted(false);
        setConfirmDelete(false);
        setSelecaoAberta(null);
        setSelecionadoId(0);
    }, [open, initial]);

    // ── Revalida ──
    React.useEffect(() => {
        if (submitAttempted) validate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clienteId, veiculoId, descricao, precoFormatado, itens]);

    const totalItens = itens.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0);

    const handleAddItem = () => {
        const lista = selecaoAberta === "servico" ? servicos : pecas;
        const selecionado = lista.find((item) => item.id === selecionadoId);
        if (!selecaoAberta || !selecionado) return;

        const exists = itens.some((item) =>
            item.tipo_item === selecaoAberta &&
            (selecaoAberta === "servico" ? item.servico_id : item.peca_id) === selecionado.id
        );
        if (exists) return;

        const preco = Number(selecionado.preco_venda ?? selecionado.preco ?? 0);
        const idCampo = selecaoAberta === "servico" ? "servico_id" : "peca_id";
        setItens((prev) => [
            ...prev,
            {
                id: `${selecaoAberta}-${selecionado.id}-${Date.now()}`,
                tipo_item: selecaoAberta,
                nome: selecionado.nome,
                [idCampo]: selecionado.id,
                quantidade: 1,
                preco_unitario: preco,
                subtotal: preco,
            },
        ]);
        setSelecaoAberta(null);
        setSelecionadoId(0);
    };

    const handleQtdChange = (id: string | number, quantidade: number) => {
        const qtd = Math.max(1, Number(quantidade) || 1);
        setItens((prev) => prev.map((item) => (
            item.id === id
                ? { ...item, quantidade: qtd, subtotal: qtd * Number(item.preco_unitario) }
                : item
        )));
    };

    const handleDeleteItem = (id: string | number) => {
        setItens((prev) => prev.filter((item) => item.id !== id));
    };

    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        if (!clienteId) errs.clienteId = "Selecione o cliente";
        if (!veiculoId) errs.veiculoId = "Selecione o veículo";
        if (!descricao.trim()) errs.descricao = "Descreva os serviços do orçamento";
        const preco = totalItens > 0 ? totalItens : parsePreco(precoFormatado);
        if (!preco || preco <= 0) errs.valor = "Informe um valor válido";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = () => {
        setSubmitAttempted(true);
        if (!validate()) return;
        onSubmit({
            clienteId,
            veiculoId,
            descricao: descricao.trim(),
            valor: totalItens > 0 ? totalItens : parsePreco(precoFormatado),
            data,
            itens,
        });
        onClose();
    };

    const precoNum = totalItens > 0 ? totalItens : parsePreco(precoFormatado);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="md"
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    overflow: "hidden",
                    boxShadow: (t) => `0 24px 60px ${alpha(t.palette.common.black, 0.18)}`,
                },
            }}
        >
            {/* ── Cabeçalho ── */}
            <Paper
                elevation={0}
                square
                sx={{
                    px: 3.5,
                    py: 2.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: (t) =>
                        `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.1)} 0%, ${alpha(
                            t.palette.primary.light,
                            0.04
                        )} 100%)`,
                    borderBottom: (t) => `1px solid ${alpha(t.palette.primary.main, 0.1)}`,
                }}
            >
                <Stack direction="row" spacing={1.75} alignItems="center">
                    <HeaderIcon>
                        <RequestQuoteRoundedIcon />
                    </HeaderIcon>
                    <Stack spacing={0.25}>
                        <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
                            {isEdit ? "Editar orçamento" : "Novo orçamento"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {isEdit ? "Atualize os dados do orçamento" : "Preencha os dados para gerar o orçamento"}
                        </Typography>
                    </Stack>
                </Stack>

                {/* Preview do valor */}
                <Stack direction="row" spacing={1.5} alignItems="center">
                    {precoNum > 0 && (
                        <Box
                            sx={{
                                display: "inline-flex",
                                alignItems: "baseline",
                                gap: 0.5,
                                px: 1.75,
                                py: 0.75,
                                borderRadius: 2,
                                bgcolor: (t) => alpha(t.palette.success.main, 0.08),
                                border: (t) => `1.5px solid ${alpha(t.palette.success.main, 0.2)}`,
                            }}
                        >
                            <Typography variant="caption" color="success.main" fontWeight={700}>R$</Typography>
                            <Typography variant="subtitle1" color="success.main" fontWeight={800}>
                                {precoNum.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </Typography>
                        </Box>
                    )}
                    <IconButton onClick={onClose} size="small">
                        <CloseRoundedIcon fontSize="small" />
                    </IconButton>
                </Stack>
            </Paper>

            {/* ── Conteúdo ── */}
            <DialogContent
                sx={{
                    px: { xs: 3, sm: 4 },
                    pt: 3,
                    pb: 2,
                    bgcolor: (t) => alpha(t.palette.background.default, 0.4),
                }}
            >
                <Grid container spacing={3}>

                    {/* ── Seção 1: Cliente e Veículo ── */}
                    <Grid item xs={12}>
                        <SectionLabel>
                            <PersonRoundedIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: "middle" }} />
                            Cliente e Veículo
                        </SectionLabel>
                        <Grid container spacing={2}>

                            {/* Cliente */}
                            <Grid item xs={12} md={6}>
                                <TextField
                                    select
                                    label="Cliente *"
                                    value={clienteId}
                                    onChange={(e) => { setClienteId(Number(e.target.value)); setVeiculoId(0); }}
                                    size="small"
                                    fullWidth
                                    error={!!errors.clienteId}
                                    helperText={errors.clienteId || " "}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <PersonRoundedIcon fontSize="small" color={errors.clienteId ? "error" : "action"} />
                                            </InputAdornment>
                                        ),
                                    }}
                                >
                                    <MenuItem value={0} disabled>Selecione o cliente</MenuItem>
                                    {clientes.map((c) => (
                                        <MenuItem key={c.id} value={c.id}>{c.nome}</MenuItem>
                                    ))}
                                </TextField>
                            </Grid>

                            {/* Veículo */}
                            <Grid item xs={12} md={6}>
                                <TextField
                                    select
                                    label="Veículo *"
                                    value={veiculoId}
                                    onChange={(e) => setVeiculoId(Number(e.target.value))}
                                    size="small"
                                    fullWidth
                                    disabled={!clienteId}
                                    error={!!errors.veiculoId}
                                    helperText={
                                        errors.veiculoId ||
                                        (!clienteId ? "Selecione um cliente primeiro" : " ")
                                    }
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                {loadingVeiculos
                                                    ? <CircularProgress size={14} />
                                                    : <DirectionsCarRoundedIcon fontSize="small" color={errors.veiculoId ? "error" : "action"} />
                                                }
                                            </InputAdornment>
                                        ),
                                    }}
                                >
                                    {veiculos.length === 0 ? (
                                        <MenuItem disabled value={0}>
                                            {clienteId ? "Nenhum veículo encontrado" : "Selecione o cliente primeiro"}
                                        </MenuItem>
                                    ) : (
                                        veiculos.map((v) => (
                                            <MenuItem key={v.id} value={v.id}>
                                                {v.modelo}
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        ml: 1, px: 0.75, py: 0.1, borderRadius: 0.75,
                                                        bgcolor: (t) => alpha(t.palette.text.primary, 0.07),
                                                        fontFamily: "monospace", fontWeight: 700, fontSize: 11,
                                                    }}
                                                >
                                                    {v.placa}
                                                </Box>
                                            </MenuItem>
                                        ))
                                    )}
                                </TextField>
                            </Grid>

                            <Grid item xs={12}>
                                <Divider sx={{ my: 1 }} />
                                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
                                    <SectionLabel sx={{ mb: 0 }}>Itens do orçamento</SectionLabel>
                                    <Stack direction="row" spacing={1}>
                                        <Button
                                            size="small"
                                            startIcon={<AddRoundedIcon />}
                                            variant={selecaoAberta === "servico" ? "contained" : "outlined"}
                                            onClick={() => setSelecaoAberta(selecaoAberta === "servico" ? null : "servico")}
                                        >
                                            Mão de obra
                                        </Button>
                                        <Button
                                            size="small"
                                            startIcon={<AddRoundedIcon />}
                                            variant={selecaoAberta === "peca" ? "contained" : "outlined"}
                                            color="secondary"
                                            onClick={() => setSelecaoAberta(selecaoAberta === "peca" ? null : "peca")}
                                        >
                                            Peças
                                        </Button>
                                    </Stack>
                                </Stack>

                                {selecaoAberta && (
                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 1.5 }}>
                                        <TextField
                                            select
                                            label={selecaoAberta === "servico" ? "Selecionar serviço" : "Selecionar peça"}
                                            value={selecionadoId}
                                            onChange={(e) => setSelecionadoId(Number(e.target.value))}
                                            size="small"
                                            fullWidth
                                        >
                                            <MenuItem value={0} disabled>
                                                {selecaoAberta === "servico" ? "Escolha um serviço" : "Escolha uma peça"}
                                            </MenuItem>
                                            {(selecaoAberta === "servico" ? servicos : pecas).map((item) => (
                                                <MenuItem key={item.id} value={item.id}>
                                                    {item.nome} — R$ {Number(item.preco_venda ?? item.preco ?? 0).toFixed(2)}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                        <Button variant="contained" disableElevation onClick={handleAddItem} sx={{ px: 3 }}>
                                            Adicionar
                                        </Button>
                                    </Stack>
                                )}

                                <Paper
                                    elevation={0}
                                    sx={{
                                        mt: 1.5,
                                        border: (t) => `1px solid ${t.palette.divider}`,
                                        borderRadius: 2,
                                        overflow: "hidden",
                                        bgcolor: "background.paper",
                                    }}
                                >
                                    {itens.length ? (
                                        <Stack divider={<Divider />}>
                                            {itens.map((item) => (
                                                <Stack
                                                    key={item.id}
                                                    direction={{ xs: "column", sm: "row" }}
                                                    spacing={1.5}
                                                    alignItems={{ xs: "stretch", sm: "center" }}
                                                    sx={{ p: 1.5 }}
                                                >
                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                        <Typography variant="body2" fontWeight={700} noWrap>
                                                            {item.nome}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {item.tipo_item === "servico" ? "Mão de obra" : "Peça"} • R$ {Number(item.preco_unitario).toFixed(2)}
                                                        </Typography>
                                                    </Box>
                                                    <TextField
                                                        type="number"
                                                        label="Qtd"
                                                        size="small"
                                                        value={item.quantidade}
                                                        onChange={(e) => handleQtdChange(item.id, Number(e.target.value))}
                                                        inputProps={{ min: 1 }}
                                                        sx={{ width: { xs: "100%", sm: 92 } }}
                                                    />
                                                    <Typography variant="body2" fontWeight={800} color="success.main" sx={{ minWidth: 110, textAlign: { xs: "left", sm: "right" } }}>
                                                        R$ {Number(item.subtotal).toFixed(2)}
                                                    </Typography>
                                                    <IconButton color="error" size="small" onClick={() => handleDeleteItem(item.id)}>
                                                        <DeleteRoundedIcon fontSize="small" />
                                                    </IconButton>
                                                </Stack>
                                            ))}
                                        </Stack>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                                            Adicione serviços e peças para a O.S. já nascer praticamente pronta.
                                        </Typography>
                                    )}
                                </Paper>
                            </Grid>
                        </Grid>
                    </Grid>

                    {/* ── Seção 2: Detalhes do orçamento ── */}
                    <Grid item xs={12}>
                        <Divider sx={{ mb: 2 }} />
                        <SectionLabel>
                            <DescriptionRoundedIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: "middle" }} />
                            Detalhes do orçamento
                        </SectionLabel>
                        <Grid container spacing={2}>

                            {/* Descrição */}
                            <Grid item xs={12}>
                                <TextField
                                    label="Descrição dos serviços *"
                                    value={descricao}
                                    onChange={(e) => setDescricao(e.target.value)}
                                    placeholder="Ex.: Troca de óleo + filtro, alinhamento, balanceamento..."
                                    size="small"
                                    fullWidth
                                    multiline
                                    rows={3}
                                    error={!!errors.descricao}
                                    helperText={errors.descricao || " "}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start" sx={{ alignSelf: "flex-start", mt: 1 }}>
                                                <DescriptionRoundedIcon fontSize="small" color={errors.descricao ? "error" : "action"} />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>

                            {/* Valor */}
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Valor total *"
                                    value={totalItens > 0 ? totalItens.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : precoFormatado}
                                    onChange={(e) => setPrecoFormatado(formatPreco(e.target.value))}
                                    disabled={totalItens > 0}
                                    placeholder="0,00"
                                    size="small"
                                    fullWidth
                                    error={!!errors.valor}
                                    helperText={errors.valor || " "}
                                    inputProps={{ inputMode: "numeric" }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Typography variant="body2" color="text.secondary" fontWeight={700}>R$</Typography>
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{
                                        "& input": {
                                            fontWeight: 700,
                                            fontSize: "1rem",
                                            color: (t) => precoNum > 0 ? t.palette.success.main : undefined,
                                        },
                                    }}
                                />
                            </Grid>

                            {/* Data */}
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Data do orçamento"
                                    type="date"
                                    value={data}
                                    onChange={(e) => setData(e.target.value)}
                                    size="small"
                                    fullWidth
                                    helperText=" "
                                    InputLabelProps={{ shrink: true }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <CalendarTodayRoundedIcon fontSize="small" color="action" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>

                {/* Alerta de erros */}
                <Collapse in={submitAttempted && Object.keys(errors).length > 0}>
                    <Alert severity="error" sx={{ mt: 1, borderRadius: 2 }}>
                        Preencha todos os campos obrigatórios antes de salvar.
                    </Alert>
                </Collapse>
            </DialogContent>

            {/* ── Rodapé ── */}
            <DialogActions
                sx={{
                    px: 4,
                    py: 2,
                    borderTop: (t) => `1px solid ${t.palette.divider}`,
                    justifyContent: "space-between",
                    bgcolor: "background.paper",
                }}
            >
                {/* Excluir */}
                <Box>
                    {isEdit && onDelete && initial && (
                        <>
                            {!confirmDelete ? (
                                <Button
                                    color="error"
                                    startIcon={<DeleteOutlineRoundedIcon />}
                                    onClick={() => setConfirmDelete(true)}
                                    sx={{ textTransform: "none", borderRadius: 999 }}
                                >
                                    Excluir orçamento
                                </Button>
                            ) : (
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography variant="body2" color="error" fontWeight={600}>
                                        Confirmar exclusão?
                                    </Typography>
                                    <Button
                                        color="error"
                                        variant="contained"
                                        size="small"
                                        disableElevation
                                        onClick={() => onDelete(initial)}
                                        sx={{ textTransform: "none", borderRadius: 999 }}
                                    >
                                        Sim, excluir
                                    </Button>
                                    <Button
                                        size="small"
                                        onClick={() => setConfirmDelete(false)}
                                        sx={{ textTransform: "none", borderRadius: 999 }}
                                    >
                                        Cancelar
                                    </Button>
                                </Stack>
                            )}
                        </>
                    )}
                </Box>

                {/* Ações principais */}
                <Stack direction="row" spacing={1.5}>
                    <Button
                        onClick={onClose}
                        sx={{ textTransform: "none", borderRadius: 999, color: "text.secondary" }}
                    >
                        Cancelar
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disableElevation
                        sx={{
                            textTransform: "none",
                            borderRadius: 999,
                            px: 3.5,
                            fontWeight: 700,
                            background: (t) =>
                                `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.primary.dark})`,
                        }}
                    >
                        {isEdit ? "Salvar alterações" : "Criar orçamento"}
                    </Button>
                </Stack>
            </DialogActions>
        </Dialog>
    );
}
