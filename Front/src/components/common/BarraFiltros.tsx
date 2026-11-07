import * as React from "react";
import { Autocomplete, Badge, Box, Button, Checkbox, ListItemText, MenuItem, Stack, TextField } from "@mui/material";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { AppDrawer, DrawerSection } from "./AppDrawer";
import CampoData from "./CampoData";

export type Opcao = { value: string; label: string; detalhe?: string };

/**
 * Campo do painel lateral.
 * - Lista: seleção múltipla (`multi`, valor string[]) ou única (valor string, "" = todos).
 * - `busca`: escolha única com campo de pesquisa (ex.: cliente), para listas longas.
 */
export type CampoFiltro<F> = {
  id: keyof F & string;
  label: string;
  opcoes: Opcao[];
  multi?: boolean;
  busca?: boolean;
  /** Texto quando nada está selecionado. Padrão: "Todos". */
  vazio?: string;
};

type Periodo = { de?: string; ate?: string };

type Props<F extends object> = {
  valores: F;
  onChange: (valores: F) => void;
  /** Valores iniciais: o que "Limpar filtros" restaura e a referência do que conta como filtro ligado. */
  padrao: F;
  campos?: CampoFiltro<F>[];
  /** Mostra o período (Data inicial/Data final) na tela. */
  periodo?: boolean;
  /** Controles da tela antes do período (ex.: visão, tipo de data). */
  inicio?: React.ReactNode;
  /** Controles da tela depois do período (ex.: busca, avisos). */
  children?: React.ReactNode;
  /** Campos que "Limpar filtros" mantém e que não contam como filtro (ex.: a visão escolhida). */
  manter?: (keyof F & string)[];
  /** Subtítulo do painel lateral. */
  subtitulo?: string;
};

const valorDe = <F extends object>(v: F, id: string) => (v as Record<string, unknown>)[id];
const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? "") === JSON.stringify(b ?? "");

/**
 * Barra de filtros padrão das listas e relatórios: na tela, o período e os controles principais; à direita,
 * "Limpar filtros" (quando algo difere do padrão) e o botão "Filtros", com o número de filtros ligados,
 * que abre o painel lateral. O painel só aplica ao clicar em Aplicar.
 */
export default function BarraFiltros<F extends object>({
  valores,
  onChange,
  padrao,
  campos = [],
  periodo = true,
  inicio,
  children,
  manter = [],
  subtitulo = "Refine a lista",
}: Props<F>) {
  const [aberto, setAberto] = React.useState(false);
  const [rascunho, setRascunho] = React.useState(valores);

  const ligado = (v: F, id: string) => !igual(valorDe(v, id), valorDe(padrao, id));
  const ativosPainel = campos.filter((c) => ligado(valores, c.id)).length;
  const { de, ate } = valores as Periodo;
  const ativo = Object.keys(padrao).some((k) => !manter.includes(k as keyof F & string) && ligado(valores, k));
  const periodoInvalido = !!de && !!ate && de > ate;

  if (!periodo && campos.length === 0 && !children && !inicio) return null;

  const comPadrao = (v: F, ids: string[]) => ids.reduce((acc, id) => ({ ...acc, [id]: valorDe(padrao, id) }), v);
  const limparTudo = () => onChange(manter.reduce((acc, id) => ({ ...acc, [id]: valorDe(valores, id) }), padrao));
  const aplicar = () => {
    onChange(campos.reduce((acc, c) => ({ ...acc, [c.id]: valorDe(rascunho, c.id) }), valores));
    setAberto(false);
  };

  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} mb={2.5} alignItems={{ md: "flex-start" }} useFlexGap>
      {inicio}
      {periodo && (
        <>
          <Box sx={{ width: { xs: "100%", md: 170 } }}>
            <CampoData label="Data inicial" value={de ?? ""} onChange={(v) => onChange({ ...valores, de: v })} />
          </Box>
          <Box sx={{ width: { xs: "100%", md: 170 } }}>
            <CampoData
              label="Data final"
              value={ate ?? ""}
              onChange={(v) => onChange({ ...valores, ate: v })}
              error={periodoInvalido}
              helperText={periodoInvalido ? "Antes da data inicial" : undefined}
            />
          </Box>
        </>
      )}
      {children}

      <Box sx={{ flex: 1 }} />

      {ativo && (
        <Button size="small" onClick={limparTudo} sx={{ textTransform: "none", fontWeight: 600, alignSelf: { md: "center" } }}>
          Limpar filtros
        </Button>
      )}
      {campos.length > 0 && (
        <Badge badgeContent={ativosPainel} color="primary" invisible={!ativosPainel} sx={{ alignSelf: { md: "center" } }}>
          <Button
            variant="outlined"
            startIcon={<TuneRoundedIcon />}
            onClick={() => { setRascunho(valores); setAberto(true); }}
            sx={{ textTransform: "none", fontWeight: 600, borderRadius: "999px" }}
          >
            Filtros
          </Button>
        </Badge>
      )}

      <AppDrawer
        open={aberto}
        onClose={() => setAberto(false)}
        title="Filtros"
        subtitle={subtitulo}
        icon={<TuneRoundedIcon />}
        width={440}
        confirmDiscard={false}
        footer={
          <>
            <Button onClick={() => setRascunho(comPadrao(rascunho, campos.map((c) => c.id)))} disabled={campos.every((c) => !ligado(rascunho, c.id))}>
              Limpar
            </Button>
            <Stack direction="row" spacing={1.5}>
              <Button onClick={() => setAberto(false)} variant="outlined">Cancelar</Button>
              <Button onClick={aplicar} variant="contained" disableElevation sx={{ fontWeight: 700 }}>
                Aplicar
              </Button>
            </Stack>
          </>
        }
      >
        <DrawerSection title="Filtros">
          <Stack spacing={2}>
            {campos.map((c) => {
              const atual = valorDe(rascunho, c.id);
              const set = (v: unknown) => setRascunho({ ...rascunho, [c.id]: v });

              if (c.busca) {
                const escolhida = c.opcoes.find((o) => o.value === atual) ?? null;
                return (
                  <Autocomplete
                    key={c.id}
                    size="small"
                    options={c.opcoes}
                    value={escolhida}
                    onChange={(_, o) => set(o ? o.value : "")}
                    getOptionLabel={(o) => o.label}
                    isOptionEqualToValue={(a, b) => a.value === b.value}
                    noOptionsText="Nada encontrado"
                    renderInput={(params) => <TextField {...params} label={c.label} placeholder={c.vazio ?? "Todos"} InputLabelProps={{ shrink: true }} />}
                  />
                );
              }

              return (
                <TextField
                  key={c.id}
                  select
                  size="small"
                  label={c.label}
                  value={c.multi ? (Array.isArray(atual) ? atual : []) : (atual ?? "")}
                  onChange={(e) => set(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  SelectProps={{
                    multiple: !!c.multi,
                    displayEmpty: true,
                    renderValue: (v) => {
                      const sel = c.multi ? (v as string[]) : v ? [v as string] : [];
                      if (sel.length === 0) return c.vazio ?? "Todos";
                      const rotulos = c.opcoes.filter((o) => sel.includes(o.value)).map((o) => o.label);
                      return rotulos.length <= 2 ? rotulos.join(", ") : `${rotulos.length} selecionados`;
                    },
                  }}
                >
                  {!c.multi && <MenuItem value="">{c.vazio ?? "Todos"}</MenuItem>}
                  {c.opcoes.map((o) => (
                    <MenuItem key={o.value} value={o.value} dense={!!c.multi}>
                      {c.multi && <Checkbox size="small" checked={Array.isArray(atual) && atual.includes(o.value)} />}
                      {c.multi || o.detalhe ? <ListItemText primary={o.label} secondary={o.detalhe} /> : o.label}
                    </MenuItem>
                  ))}
                </TextField>
              );
            })}
          </Stack>
        </DrawerSection>
      </AppDrawer>
    </Stack>
  );
}
