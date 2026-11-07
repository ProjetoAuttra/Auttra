import * as React from "react";
import { Autocomplete, Badge, Box, Button, Checkbox, ListItemText, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { AppDrawer, DrawerSection } from "../../../components/common/AppDrawer";
import CampoData from "../../../components/common/CampoData";
import { METODO_FILTRO_OPTIONS as METODO_OPTIONS, hojeInput } from "../api/api";

export type StatusConta = "pendente" | "vencido" | "pago" | "cancelado";

export type DataPor = "vencimento" | "pagamento";

export type FiltrosConta = {
  /** Vazio = todas as situações. */
  situacao: StatusConta[];
  /** A que data o período se refere: vencimento ou recebimento/pagamento. */
  dataPor: DataPor;
  /** Período (YYYY-MM-DD); o padrão é o mês atual. */
  de: string;
  ate: string;
  parceiroId: string;
  /** Vazio = todas as formas de pagamento. */
  metodos: string[];
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Vencimento do dia 1 ao último dia do mês atual, sem filtro de situação nem de detalhes. */
export function filtrosPadrao(hoje = new Date()): FiltrosConta {
  return {
    situacao: [],
    dataPor: "vencimento",
    de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
    ate: iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
    parceiroId: "",
    metodos: [],
  };
}

/** Filtros do painel lateral (os que não ficam visíveis na tela). */
export const contarFiltrosAvancados = (f: FiltrosConta) => (f.situacao.length ? 1 : 0) + (f.parceiroId ? 1 : 0) + (f.metodos.length ? 1 : 0);

/** Algum filtro difere do padrão (vencimento no mês atual, sem situação nem detalhes). */
export function temFiltroAtivo(f: FiltrosConta, padrao = filtrosPadrao()) {
  return contarFiltrosAvancados(f) > 0 || f.dataPor !== padrao.dataPor || f.de !== padrao.de || f.ate !== padrao.ate;
}

/**
 * "Vencidos" com o período padrão (vencimento no mês atual) mostraria só os vencidos deste mês,
 * enquanto o card "Vencidos" soma todos. Nesse caso o período de vencimento não vai para a API.
 * Se o usuário mudar o período, ele volta a valer.
 */
export function vencidosSemPeriodo(f: FiltrosConta, padrao = filtrosPadrao()) {
  return f.situacao.includes("vencido") && f.dataPor === "vencimento" && f.de === padrao.de && f.ate === padrao.ate;
}

/** Parâmetros de GET /pagamentos para os filtros (campo do parceiro: cliente_id ou fornecedor_id). */
export function paramsFiltros(f: FiltrosConta, campoParceiro: "cliente_id" | "fornecedor_id", padrao = filtrosPadrao()) {
  const porPagamento = f.dataPor === "pagamento";
  const semPeriodo = vencidosSemPeriodo(f, padrao);
  return {
    status: f.situacao.join(","),
    hoje: f.situacao.includes("vencido") ? hojeInput() : "",
    [porPagamento ? "pagamento_de" : "vencimento_de"]: semPeriodo ? "" : f.de,
    [porPagamento ? "pagamento_ate" : "vencimento_ate"]: semPeriodo ? "" : f.ate,
    tz_offset: porPagamento ? String(new Date().getTimezoneOffset()) : "",
    metodo: f.metodos.join(","),
    [campoParceiro]: f.parceiroId,
  };
}

const SITUACOES: StatusConta[] = ["pendente", "vencido", "pago", "cancelado"];

/** Situações vindas da URL (?situacao=vencido ou ?situacao=vencido,pendente), ignorando valores desconhecidos. */
export const situacaoDaUrl = (valor: string | null): StatusConta[] =>
  (valor ?? "").split(",").filter((s): s is StatusConta => SITUACOES.includes(s as StatusConta));

/**
 * Filtros das contas com a situação na URL: links (ex.: alerta do painel) abrem a lista já filtrada
 * e mudar a situação na tela atualiza o endereço, sem empilhar histórico.
 */
export function useFiltrosContas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtros, setFiltrosState] = React.useState<FiltrosConta>(() => ({
    ...filtrosPadrao(),
    situacao: situacaoDaUrl(searchParams.get("situacao")),
  }));
  const setFiltros = React.useCallback((f: FiltrosConta) => {
    setFiltrosState(f);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (f.situacao.length) next.set("situacao", f.situacao.join(","));
      else next.delete("situacao");
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  return [filtros, setFiltros] as const;
}

type Parceiro = { id: number; nome: string };

type Props = {
  filtros: FiltrosConta;
  onChange: (f: FiltrosConta) => void;
  /** Contas a receber ou a pagar: define os rótulos Recebidos/Recebimento ou Pagos/Pagamento. */
  tipo: "receber" | "pagar";
  rotuloParceiro: "Cliente" | "Fornecedor";
  parceiros: Parceiro[];
};

/** Linha de filtros das contas: tipo de data e período na tela; situação, cliente/fornecedor e forma de pagamento num painel lateral. */
export default function FiltrosContas({ filtros, onChange, tipo, rotuloParceiro, parceiros }: Props) {
  const [aberto, setAberto] = React.useState(false);
  const [rascunho, setRascunho] = React.useState(filtros);
  const ativosAvancados = contarFiltrosAvancados(filtros);
  const set = (parcial: Partial<FiltrosConta>) => onChange({ ...filtros, ...parcial });
  const setRascunhoCampo = (parcial: Partial<FiltrosConta>) => setRascunho((r) => ({ ...r, ...parcial }));

  const situacaoOpcoes: { value: StatusConta; label: string }[] = [
    { value: "pendente", label: "Pendentes" },
    { value: "vencido", label: "Vencidos" },
    { value: "pago", label: tipo === "receber" ? "Recebidos" : "Pagos" },
    { value: "cancelado", label: "Cancelados" },
  ];
  const rotuloSituacao = (selecionados: string[]) =>
    selecionados.length === 0
      ? "Todas as situações"
      : selecionados.length <= 2
        ? situacaoOpcoes.filter((o) => selecionados.includes(o.value)).map((o) => o.label).join(", ")
        : `${selecionados.length} situações`;
  const rotuloMetodos = (selecionados: string[]) =>
    selecionados.length === 0 ? "Todas" : METODO_OPTIONS.filter((m) => selecionados.includes(m.value)).map((m) => m.label).join(", ");

  const periodoInvalido = !!filtros.de && !!filtros.ate && filtros.de > filtros.ate;
  const parceiro = parceiros.find((p) => String(p.id) === rascunho.parceiroId) ?? null;
  const padrao = filtrosPadrao();
  const ativo = temFiltroAtivo(filtros, padrao);

  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} mb={2.5} alignItems={{ md: "flex-start" }} useFlexGap>
      <TextField
        select
        size="small"
        label="Data"
        value={filtros.dataPor}
        onChange={(e) => set({ dataPor: e.target.value as DataPor })}
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="vencimento">Vencimento</MenuItem>
        <MenuItem value="pagamento">{tipo === "receber" ? "Recebimento" : "Pagamento"}</MenuItem>
      </TextField>

      <Box sx={{ width: { xs: "100%", md: 170 } }}>
        <CampoData label="Data inicial" value={filtros.de} onChange={(v) => set({ de: v })} />
      </Box>
      <Box sx={{ width: { xs: "100%", md: 170 } }}>
        <CampoData label="Data final" value={filtros.ate} onChange={(v) => set({ ate: v })} error={periodoInvalido} helperText={periodoInvalido ? "Antes da data inicial" : undefined} />
      </Box>

      {vencidosSemPeriodo(filtros, padrao) && (
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: { md: "center" } }}>
          Vencidos: todos os períodos
        </Typography>
      )}

      <Box sx={{ flex: 1 }} />

      {ativo && (
        <Button size="small" onClick={() => onChange(padrao)} sx={{ textTransform: "none", fontWeight: 600, alignSelf: { md: "center" } }}>
          Limpar filtros
        </Button>
      )}
      <Badge badgeContent={ativosAvancados} color="primary" invisible={!ativosAvancados} sx={{ alignSelf: { md: "center" } }}>
        <Button variant="outlined" startIcon={<TuneRoundedIcon />} onClick={() => { setRascunho(filtros); setAberto(true); }} sx={{ textTransform: "none", fontWeight: 600, borderRadius: "999px" }}>
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
            <Button onClick={() => setRascunhoCampo({ situacao: [], parceiroId: "", metodos: [] })} disabled={!contarFiltrosAvancados(rascunho)}>Limpar</Button>
            <Stack direction="row" spacing={1.5}>
              <Button onClick={() => setAberto(false)} variant="outlined">Cancelar</Button>
              <Button onClick={() => { set({ situacao: rascunho.situacao, parceiroId: rascunho.parceiroId, metodos: rascunho.metodos }); setAberto(false); }} variant="contained" disableElevation sx={{ fontWeight: 700 }}>Aplicar</Button>
            </Stack>
          </>
        }
      >
        <DrawerSection title="Filtros">
          <Stack spacing={2}>
            <TextField
              select
              size="small"
              label="Situação"
              value={rascunho.situacao}
              onChange={(e) => setRascunhoCampo({ situacao: e.target.value as unknown as StatusConta[] })}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ multiple: true, displayEmpty: true, renderValue: (v) => rotuloSituacao(v as string[]) }}
            >
              {situacaoOpcoes.map((o) => (
                <MenuItem key={o.value} value={o.value} dense>
                  <Checkbox size="small" checked={rascunho.situacao.includes(o.value)} />
                  <ListItemText primary={o.label} />
                </MenuItem>
              ))}
            </TextField>
            <Autocomplete
              size="small"
              options={parceiros}
              value={parceiro}
              onChange={(_, v) => setRascunhoCampo({ parceiroId: v ? String(v.id) : "" })}
              getOptionLabel={(p) => p.nome}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              noOptionsText={`Nenhum ${rotuloParceiro.toLowerCase()} encontrado`}
              renderInput={(params) => <TextField {...params} label={rotuloParceiro} />}
            />
            <TextField
              select
              size="small"
              label="Forma de pagamento"
              value={rascunho.metodos}
              onChange={(e) => setRascunhoCampo({ metodos: e.target.value as unknown as string[] })}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ multiple: true, displayEmpty: true, renderValue: (v) => rotuloMetodos(v as string[]) }}
            >
              {METODO_OPTIONS.map((m) => (
                <MenuItem key={m.value} value={m.value} dense>
                  <Checkbox size="small" checked={rascunho.metodos.includes(m.value)} />
                  <ListItemText primary={m.label} />
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DrawerSection>
      </AppDrawer>
    </Stack>
  );
}
