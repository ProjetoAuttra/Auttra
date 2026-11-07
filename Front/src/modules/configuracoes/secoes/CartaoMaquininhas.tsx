import * as React from "react";
import {
  Avatar, Box, Button, Card, Chip, CircularProgress, Divider, FormControlLabel, IconButton, InputAdornment,
  MenuItem, Stack, Switch, TextField, Tooltip, Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import PercentRoundedIcon from "@mui/icons-material/PercentRounded";
import { AppDialog, AppDialogActions, AppDialogContent, SectionLabel } from "../../../components/common/AppDialog";
import { useConfirm } from "../../../context/ConfirmContext";
import { useToast } from "../../../context/ToastContext";
import { maskDecimal, parseDecimal } from "../../../utils/masks";
import {
  MAX_PARCELAS, OPERADORAS, atualizarMaquininha, criarMaquininha, excluirMaquininha, listarMaquininhas,
  novaMaquininha, operadora, resumoTaxas, type Maquininha, type MaquininhaForm,
} from "../api/maquininhas";

const borda = (t: { palette: { divider: string } }) => `1px solid ${t.palette.divider}`;

/** Selo com a inicial e a cor da operadora. */
export function SeloOperadora({ valor, tamanho = 40 }: { valor?: string | null; tamanho?: number }) {
  const op = operadora(valor);
  return (
    <Avatar
      variant="rounded"
      aria-hidden
      sx={{ width: tamanho, height: tamanho, bgcolor: op?.cor ?? "action.selected", color: op ? "#fff" : "text.secondary", fontWeight: 800, fontSize: tamanho * 0.4 }}
    >
      {op ? op.label.charAt(0) : <CreditCardRoundedIcon fontSize="small" />}
    </Avatar>
  );
}

/**
 * Cartão "Maquininhas de cartão" da seção Financeiro. Diferente dos outros cartões, cada maquininha
 * salva na hora pelo próprio modal (não depende do "Salvar alterações" da seção).
 */
export default function CartaoMaquininhas({ podeEditar }: { podeEditar: boolean }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [lista, setLista] = React.useState<Maquininha[] | null>(null);
  const [falhou, setFalhou] = React.useState(false);
  const [editando, setEditando] = React.useState<Maquininha | "nova" | null>(null);

  const carregar = React.useCallback(() => {
    setFalhou(false);
    listarMaquininhas(true)
      .then((l) => setLista(Array.isArray(l) ? l : []))
      .catch(() => setFalhou(true));
  }, []);
  React.useEffect(carregar, [carregar]);

  const excluir = async (m: Maquininha) => {
    const ok = await confirm({
      title: `Excluir "${m.nome}"?`,
      message: "Ela sai da lista e não pode mais ser usada para receber. Os recebimentos já feitos continuam com a taxa da época.",
      confirmLabel: "Excluir",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await excluirMaquininha(m.id);
      setLista((l) => l?.filter((x) => x.id !== m.id) ?? null);
      toast.success("Maquininha excluída.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Não foi possível excluir a maquininha.");
    }
  };

  const salva = (m: Maquininha) => {
    setLista((l) => {
      const outras = (l ?? []).filter((x) => x.id !== m.id);
      return [...outras, m].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, "pt-BR"));
    });
    setEditando(null);
  };

  return (
    <Card component="section" aria-label="Maquininhas de cartão">
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ px: { xs: 2, md: 3 }, py: 2, borderBottom: borda }}>
        <Box>
          <Typography fontWeight={700}>Maquininhas de cartão</Typography>
          <Typography variant="body2" color="text.secondary">
            Taxas e prazos de cada operadora. Ao receber no cartão, o sistema desconta a taxa e mostra o valor líquido.
          </Typography>
        </Box>
        {podeEditar && (
          <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setEditando("nova")} sx={{ flexShrink: 0 }}>
            Adicionar
          </Button>
        )}
      </Stack>

      <Box sx={{ px: { xs: 2, md: 3 } }}>
        {falhou ? (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2.5 }}>
            <Typography variant="body2" color="error">Não foi possível carregar as maquininhas.</Typography>
            <Button size="small" onClick={carregar}>Tentar novamente</Button>
          </Stack>
        ) : lista === null ? (
          <Box sx={{ py: 3, textAlign: "center" }}><CircularProgress size={22} /></Box>
        ) : lista.length === 0 ? (
          <Box sx={{ py: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Nenhuma maquininha cadastrada. Sem elas, recebimentos no cartão entram pelo valor bruto, sem descontar a taxa.
            </Typography>
          </Box>
        ) : (
          <Stack divider={<Divider flexItem />}>
            {lista.map((m) => (
              <Stack key={m.id} direction="row" alignItems="center" spacing={2} sx={{ py: 1.75, opacity: m.ativo ? 1 : 0.6 }}>
                <SeloOperadora valor={m.operadora} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" fontWeight={700} noWrap>{m.nome}</Typography>
                    {!m.ativo && <Chip size="small" label="Inativa" />}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">{resumoTaxas(m)}</Typography>
                </Box>
                {m.aceita_credito && <Chip size="small" color="success" variant="outlined" label={`${m.taxas_credito.length}x`} sx={{ fontWeight: 700 }} />}
                {podeEditar && (
                  <Stack direction="row">
                    <Tooltip title="Editar"><IconButton aria-label={`Editar ${m.nome}`} onClick={() => setEditando(m)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Excluir"><IconButton aria-label={`Excluir ${m.nome}`} onClick={() => excluir(m)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip>
                  </Stack>
                )}
              </Stack>
            ))}
          </Stack>
        )}
      </Box>

      <MaquininhaDialog
        open={editando !== null}
        maquininha={editando === "nova" ? null : editando}
        onClose={() => setEditando(null)}
        onSalva={salva}
      />
    </Card>
  );
}

// ── Modal de configuração ───────────────────────────────────────────────────

/** Percentuais ficam como texto no formulário ("2,5"), para aceitar vírgula e apagar sem virar 0. */
type Form = Omit<MaquininhaForm, "taxa_debito" | "taxas_credito"> & { taxa_debito: string; taxas_credito: string[] };

const paraTexto = (v: number) => String(v).replace(".", ",");
const deMaquininha = (m: MaquininhaForm): Form => ({ ...m, taxa_debito: paraTexto(m.taxa_debito), taxas_credito: m.taxas_credito.map(paraTexto) });
const pctValido = (t: string) => t.trim() !== "" && parseDecimal(t) >= 0 && parseDecimal(t) <= 100;
const diasValido = (n: number) => Number.isInteger(n) && n >= 0 && n <= 365;

function CampoPct({ label, valor, onChange, ...props }: { label?: string; valor: string; onChange: (v: string) => void; autoFocus?: boolean; inputProps?: object }) {
  const erro = !pctValido(valor);
  return (
    <TextField
      label={label}
      size="small"
      fullWidth
      value={valor}
      onChange={(e) => onChange(maskDecimal(e.target.value))}
      error={erro}
      InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
      inputProps={{ inputMode: "decimal", ...props.inputProps }}
      autoFocus={props.autoFocus}
    />
  );
}

function CampoDias({ label, valor, onChange, helperText }: { label: string; valor: number; onChange: (v: number) => void; helperText?: string }) {
  return (
    <TextField
      label={label}
      size="small"
      fullWidth
      type="number"
      value={Number.isNaN(valor) ? "" : valor}
      onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
      error={!diasValido(valor)}
      helperText={!diasValido(valor) ? "De 0 a 365 dias" : helperText ?? " "}
      InputProps={{ endAdornment: <InputAdornment position="end">dias</InputAdornment> }}
      inputProps={{ min: 0, max: 365 }}
    />
  );
}

export function MaquininhaDialog({ open, maquininha, onClose, onSalva }: {
  open: boolean;
  maquininha: Maquininha | null;
  onClose: () => void;
  onSalva: (m: Maquininha) => void;
}) {
  const toast = useToast();
  const [form, setForm] = React.useState<Form>(() => deMaquininha(novaMaquininha()));
  const [salvando, setSalvando] = React.useState(false);
  const [mostrarErros, setMostrarErros] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setForm(deMaquininha(maquininha ?? novaMaquininha()));
    setMostrarErros(false);
  }, [open, maquininha]);

  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const parcelas = form.taxas_credito.length;

  /** Muda o máximo de parcelas mantendo as taxas já digitadas; as novas começam com a taxa da última. */
  const mudarParcelas = (n: number) => {
    const ultima = form.taxas_credito[form.taxas_credito.length - 1] ?? "0";
    set({ taxas_credito: Array.from({ length: n }, (_, i) => form.taxas_credito[i] ?? ultima) });
  };
  const mudarTaxa = (i: number, v: string) => set({ taxas_credito: form.taxas_credito.map((t, j) => (j === i ? v : t)) });

  // Só valida o que a maquininha aceita: a parte desligada nem aparece.
  const nenhumTipo = !form.aceita_debito && !form.aceita_credito;
  const invalido =
    !form.nome.trim() ||
    nenhumTipo ||
    (form.aceita_debito && (!pctValido(form.taxa_debito) || !diasValido(form.prazo_debito_dias))) ||
    (form.aceita_credito && (form.taxas_credito.some((t) => !pctValido(t)) || !diasValido(form.prazo_credito_dias)));

  const salvar = async () => {
    if (invalido) { setMostrarErros(true); return; }
    setSalvando(true);
    // A parte desligada vai com o que já estava (ou o padrão), para voltar igual se for religada.
    const original = maquininha ?? novaMaquininha();
    const dados: MaquininhaForm = {
      ...form,
      nome: form.nome.trim(),
      taxa_debito: form.aceita_debito ? parseDecimal(form.taxa_debito) : original.taxa_debito,
      prazo_debito_dias: form.aceita_debito ? form.prazo_debito_dias : original.prazo_debito_dias,
      taxas_credito: form.aceita_credito ? form.taxas_credito.map(parseDecimal) : original.taxas_credito,
      prazo_credito_dias: form.aceita_credito ? form.prazo_credito_dias : original.prazo_credito_dias,
    };
    try {
      const salva = maquininha ? await atualizarMaquininha(maquininha.id, dados) : await criarMaquininha(dados);
      toast.success(maquininha ? "Maquininha atualizada." : "Maquininha cadastrada.");
      onSalva(salva);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Não foi possível salvar a maquininha.");
    } finally {
      setSalvando(false);
    }
  };

  const metade = Math.ceil(parcelas / 2);
  const colunas = [form.taxas_credito.slice(0, metade), form.taxas_credito.slice(metade)];

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      onCloseClick={onClose}
      closeOnBackdrop={false}
      maxWidth="sm"
      fullWidth
      title={maquininha ? "Configurar maquininha" : "Nova maquininha"}
      icon={<CreditCardRoundedIcon />}
      variant="entity"
    >
      <AppDialogContent>
        <Stack spacing={3}>
          <Box>
            <SectionLabel>Identificação</SectionLabel>
            <Stack spacing={2}>
              <TextField
                label="Nome *"
                placeholder="Ex.: Stone do balcão"
                size="small"
                fullWidth
                autoFocus
                value={form.nome}
                onChange={(e) => set({ nome: e.target.value })}
                error={mostrarErros && !form.nome.trim()}
                helperText={mostrarErros && !form.nome.trim() ? "Informe o nome" : " "}
                inputProps={{ maxLength: 60 }}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
                <TextField
                  select
                  label="Operadora"
                  size="small"
                  fullWidth
                  value={form.operadora ?? ""}
                  onChange={(e) => {
                    const op = e.target.value || null;
                    // Nome vazio ganha o nome da operadora, para o caso mais comum (uma maquininha por operadora).
                    set({ operadora: op, ...(!form.nome.trim() && op ? { nome: operadora(op)?.label ?? "" } : {}) });
                  }}
                  SelectProps={{
                    renderValue: (v) => (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <SeloOperadora valor={v as string} tamanho={22} />
                        <span>{operadora(v as string)?.label ?? "Outra"}</span>
                      </Stack>
                    ),
                    displayEmpty: true,
                  }}
                  InputLabelProps={{ shrink: true }}
                >
                  {OPERADORAS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      <Stack direction="row" spacing={1} alignItems="center"><SeloOperadora valor={o.value} tamanho={22} /><span>{o.label}</span></Stack>
                    </MenuItem>
                  ))}
                  <MenuItem value="">
                    <Stack direction="row" spacing={1} alignItems="center"><SeloOperadora valor={null} tamanho={22} /><span>Outra</span></Stack>
                  </MenuItem>
                </TextField>
                <FormControlLabel
                  sx={{ ml: 0, flexShrink: 0 }}
                  control={<Switch checked={form.ativo} onChange={(e) => set({ ativo: e.target.checked })} />}
                  label={<Typography variant="body2" fontWeight={600}>{form.ativo ? "Ativa" : "Inativa"}</Typography>}
                />
              </Stack>
            </Stack>
          </Box>

          <Box>
            <SectionLabel>Aceita</SectionLabel>
            <Stack direction="row" spacing={3}>
              <FormControlLabel
                sx={{ ml: 0 }}
                control={<Switch checked={form.aceita_debito} onChange={(e) => set({ aceita_debito: e.target.checked })} />}
                label={<Typography variant="body2" fontWeight={600}>Débito</Typography>}
              />
              <FormControlLabel
                sx={{ ml: 0 }}
                control={<Switch checked={form.aceita_credito} onChange={(e) => set({ aceita_credito: e.target.checked })} />}
                label={<Typography variant="body2" fontWeight={600}>Crédito</Typography>}
              />
            </Stack>
            {nenhumTipo && (
              <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
                Ligue débito, crédito ou os dois.
              </Typography>
            )}
          </Box>

          {form.aceita_debito && (
          <Box>
            <SectionLabel>Débito</SectionLabel>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <CampoPct label="Taxa do débito *" valor={form.taxa_debito} onChange={(v) => set({ taxa_debito: v })} />
              <CampoDias label="Recebe em *" valor={form.prazo_debito_dias} onChange={(v) => set({ prazo_debito_dias: v })} helperText="Dias depois da venda" />
            </Stack>
          </Box>
          )}

          {form.aceita_credito && (
          <>
          <Box>
            <SectionLabel>Crédito</SectionLabel>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  select
                  label="Parcela em até *"
                  size="small"
                  fullWidth
                  value={parcelas}
                  onChange={(e) => mudarParcelas(Number(e.target.value))}
                  helperText=" "
                >
                  {Array.from({ length: MAX_PARCELAS }, (_, i) => i + 1).map((n) => (
                    <MenuItem key={n} value={n}>{n === 1 ? "Só à vista" : `${n}x`}</MenuItem>
                  ))}
                </TextField>
                <CampoDias
                  label={form.antecipacao || parcelas === 1 ? "Recebe em *" : "1ª parcela em *"}
                  valor={form.prazo_credito_dias}
                  onChange={(v) => set({ prazo_credito_dias: v })}
                  helperText={form.antecipacao || parcelas === 1 ? "Dias depois da venda" : "As demais a cada 30 dias"}
                />
              </Stack>
              {parcelas > 1 && (
                <FormControlLabel
                  sx={{ ml: 0, alignItems: "flex-start" }}
                  control={<Switch checked={form.antecipacao} onChange={(e) => set({ antecipacao: e.target.checked })} sx={{ mt: -0.75 }} />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>Antecipação automática</Typography>
                      <Typography variant="caption" color="text.secondary">
                        O parcelado cai todo de uma vez, no prazo acima. Use a taxa já com a antecipação.
                      </Typography>
                    </Box>
                  }
                />
              )}
            </Stack>
          </Box>

          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Avatar sx={{ width: 28, height: 28, bgcolor: "primary.main", opacity: 0.9 }}><PercentRoundedIcon sx={{ fontSize: 16 }} /></Avatar>
              <Typography fontWeight={700}>Taxa do crédito por parcela</Typography>
            </Stack>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, columnGap: 3, rowGap: 1.25 }}>
              {colunas.map((col, c) => (
                <Stack key={c} spacing={1.25}>
                  {col.map((t, k) => {
                    const i = c * metade + k;
                    return (
                      <Stack key={i} direction="row" spacing={1.5} alignItems="center">
                        <Typography color="primary" fontWeight={800} sx={{ width: 64, flexShrink: 0 }}>
                          {i === 0 ? "À vista" : `${i + 1}x`}
                        </Typography>
                        {/* O rótulo visível é o "3x" ao lado; o campo leva o nome completo só para leitor de tela. */}
                        <CampoPct
                          valor={t}
                          onChange={(v) => mudarTaxa(i, v)}
                          inputProps={{ "aria-label": i === 0 ? "Taxa do crédito à vista" : `Taxa do crédito em ${i + 1}x` }}
                        />
                      </Stack>
                    );
                  })}
                </Stack>
              ))}
            </Box>
            {mostrarErros && form.taxas_credito.some((t) => !pctValido(t)) && (
              <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>Preencha todas as taxas com um percentual de 0 a 100.</Typography>
            )}
          </Box>
          </>
          )}
        </Stack>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
        <Button
          variant="contained"
          disableElevation
          onClick={salvar}
          disabled={salvando}
          startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ fontWeight: 700 }}
        >
          Salvar
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}
