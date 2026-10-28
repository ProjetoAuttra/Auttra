import * as React from "react";
import { alpha, Autocomplete, Badge, Box, Button, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup } from "@mui/material";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { AppDrawer, DrawerSection } from "../../../components/common/AppDrawer";
import CampoData from "../../../components/common/CampoData";
import { brand } from "../../../app/theme";
import { METODO_OPTIONS } from "../api/api";

export type StatusConta = "todos" | "pendente" | "vencido" | "pago" | "cancelado";

/** Filtros do painel lateral; os de status ficam sempre visíveis na tela. */
export type FiltrosAvancados = { de: string; ate: string; parceiroId: string; metodo: string };

export const FILTROS_AVANCADOS_VAZIOS: FiltrosAvancados = { de: "", ate: "", parceiroId: "", metodo: "" };

export const contarFiltrosAvancados = (f: FiltrosAvancados) => Object.values(f).filter(Boolean).length;

const STATUS: { value: StatusConta; label: string; cor?: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Pendentes", cor: brand.amber },
  { value: "vencido", label: "Vencidos", cor: brand.error },
  { value: "pago", label: "Pagos", cor: brand.success },
  { value: "cancelado", label: "Cancelados" },
];

type Parceiro = { id: number; nome: string };

type Props = {
  status: StatusConta;
  onStatusChange: (s: StatusConta) => void;
  avancados: FiltrosAvancados;
  onAvancadosChange: (f: FiltrosAvancados) => void;
  /** Rótulo do status "pago": Recebidos nas contas a receber, Pagos nas a pagar. */
  rotuloPago: string;
  rotuloParceiro: "Cliente" | "Fornecedor";
  parceiros: Parceiro[];
};

/** Linha de filtros das contas: status direto na tela e o restante (período, cliente/fornecedor, método) num painel lateral. */
export default function FiltrosContas({ status, onStatusChange, avancados, onAvancadosChange, rotuloPago, rotuloParceiro, parceiros }: Props) {
  const [aberto, setAberto] = React.useState(false);
  const [rascunho, setRascunho] = React.useState(avancados);
  const ativos = contarFiltrosAvancados(avancados);

  const abrir = () => { setRascunho(avancados); setAberto(true); };
  const set = (campo: keyof FiltrosAvancados, valor: string) => setRascunho((r) => ({ ...r, [campo]: valor }));
  const aplicar = () => { onAvancadosChange(rascunho); setAberto(false); };
  const periodoInvalido = !!rascunho.de && !!rascunho.ate && rascunho.de > rascunho.ate;
  const parceiro = parceiros.find((p) => String(p.id) === rascunho.parceiroId) ?? null;

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mb={2.5} alignItems={{ sm: "center" }} flexWrap="wrap" useFlexGap>
      <ToggleButtonGroup
        value={status}
        exclusive
        onChange={(_, v) => { if (v !== null) onStatusChange(v); }}
        size="small"
        sx={{ flexWrap: "wrap", "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 600, px: 2, borderRadius: "999px !important", border: (t) => `1px solid ${t.palette.divider} !important`, mx: 0.25 } }}
      >
        {STATUS.map((s) => (
          <ToggleButton
            key={s.value}
            value={s.value}
            sx={s.cor ? { "&.Mui-selected": { bgcolor: alpha(s.cor, 0.1), color: s.cor } } : undefined}
          >
            {s.value === "pago" ? rotuloPago : s.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Box sx={{ flex: 1 }} />

      {ativos > 0 && (
        <Button size="small" onClick={() => onAvancadosChange(FILTROS_AVANCADOS_VAZIOS)} sx={{ textTransform: "none", fontWeight: 600 }}>
          Limpar filtros
        </Button>
      )}
      <Badge badgeContent={ativos} color="primary" invisible={!ativos}>
        <Button variant="outlined" startIcon={<TuneRoundedIcon />} onClick={abrir} sx={{ textTransform: "none", fontWeight: 600, borderRadius: "999px" }}>
          Filtros
        </Button>
      </Badge>

      <AppDrawer
        open={aberto}
        onClose={() => setAberto(false)}
        title="Filtros"
        subtitle="Refine a lista de contas"
        icon={<TuneRoundedIcon />}
        width={440}
        confirmDiscard={false}
        footer={
          <>
            <Button onClick={() => setRascunho(FILTROS_AVANCADOS_VAZIOS)} disabled={!contarFiltrosAvancados(rascunho)}>Limpar</Button>
            <Stack direction="row" spacing={1.5}>
              <Button onClick={() => setAberto(false)} variant="outlined">Cancelar</Button>
              <Button onClick={aplicar} variant="contained" disableElevation disabled={periodoInvalido} sx={{ fontWeight: 700 }}>Aplicar</Button>
            </Stack>
          </>
        }
      >
        <DrawerSection title="Vencimento">
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <CampoData label="De" value={rascunho.de} onChange={(v) => set("de", v)} />
            <CampoData label="Até" value={rascunho.ate} onChange={(v) => set("ate", v)} error={periodoInvalido} helperText={periodoInvalido ? "Antes da data inicial" : undefined} />
          </Box>
        </DrawerSection>

        <DrawerSection title="Detalhes">
          <Stack spacing={2}>
            <Autocomplete
              size="small"
              options={parceiros}
              value={parceiro}
              onChange={(_, v) => set("parceiroId", v ? String(v.id) : "")}
              getOptionLabel={(p) => p.nome}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              noOptionsText={`Nenhum ${rotuloParceiro.toLowerCase()} encontrado`}
              renderInput={(params) => <TextField {...params} label={rotuloParceiro} />}
            />
            <TextField select size="small" label="Forma de pagamento" value={rascunho.metodo} InputLabelProps={{ shrink: true }} SelectProps={{ displayEmpty: true }} onChange={(e) => set("metodo", e.target.value)}>
              <MenuItem value="">Todas</MenuItem>
              {METODO_OPTIONS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
            </TextField>
          </Stack>
        </DrawerSection>
      </AppDrawer>
    </Stack>
  );
}
