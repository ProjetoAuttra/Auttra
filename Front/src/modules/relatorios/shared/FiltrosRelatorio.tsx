import * as React from "react";
import { Badge, Box, Button, Checkbox, ListItemText, MenuItem, Stack, TextField } from "@mui/material";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { AppDrawer, DrawerSection } from "../../../components/common/AppDrawer";
import CampoData from "../../../components/common/CampoData";

export type Opcao = { value: string; label: string };

/** Campo do painel lateral: lista de opções com seleção múltipla (valor string[]) ou única (valor string, "" = todos). */
export type CampoFiltro<F> = {
  id: keyof F & string;
  label: string;
  opcoes: Opcao[];
  multi?: boolean;
  /** Texto quando nada está selecionado. Padrão: "Todos". */
  vazio?: string;
};

type Periodo = { de?: string; ate?: string };

type Props<F extends object> = {
  valores: F;
  onChange: (valores: F) => void;
  /** Valores iniciais: o que "Limpar filtros" restaura. */
  padrao: F;
  campos?: CampoFiltro<F>[];
  /** Mostra o período (Data inicial/Data final) na tela. */
  periodo?: boolean;
  /** Controles extras que ficam na tela, ao lado do período (ex.: campo de busca). */
  children?: React.ReactNode;
};

const vazio = (v: unknown) => (Array.isArray(v) ? v.length === 0 : !v);

/** Filtros dos relatórios: período na tela e os demais num painel lateral, igual às contas a receber/pagar. */
export default function FiltrosRelatorio<F extends object>({ valores, onChange, padrao, campos = [], periodo = true, children }: Props<F>) {
  const [aberto, setAberto] = React.useState(false);
  const [rascunho, setRascunho] = React.useState(valores);

  const valorDe = (v: F, id: string) => (v as Record<string, unknown>)[id];
  const ativosPainel = campos.filter((c) => !vazio(valorDe(valores, c.id))).length;
  const { de, ate } = valores as Periodo;
  // Qualquer valor diferente do padrão (inclusive campos extras da página, como a busca) conta como filtro ativo.
  const ativo = JSON.stringify(valores) !== JSON.stringify(padrao);
  const periodoInvalido = !!de && !!ate && de > ate;

  if (!periodo && campos.length === 0 && !children) return null;

  const limparPainel = (v: F) => campos.reduce((acc, c) => ({ ...acc, [c.id]: valorDe(padrao, c.id) }), v);

  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} mb={2.5} alignItems={{ md: "flex-start" }} useFlexGap>
      {periodo && (
        <>
          <Box sx={{ width: { xs: "100%", md: 170 } }}>
            <CampoData label="Data inicial" value={de ?? ""} onChange={(v) => onChange({ ...valores, de: v })} />
          </Box>
          <Box sx={{ width: { xs: "100%", md: 170 } }}>
            <CampoData label="Data final" value={ate ?? ""} onChange={(v) => onChange({ ...valores, ate: v })} error={periodoInvalido} helperText={periodoInvalido ? "Antes da data inicial" : undefined} />
          </Box>
        </>
      )}
      {children}

      <Box sx={{ flex: 1 }} />

      {ativo && (
        <Button size="small" onClick={() => onChange(padrao)} sx={{ textTransform: "none", fontWeight: 600, alignSelf: { md: "center" } }}>
          Limpar filtros
        </Button>
      )}
      {campos.length > 0 && (
        <Badge badgeContent={ativosPainel} color="primary" invisible={!ativosPainel} sx={{ alignSelf: { md: "center" } }}>
          <Button variant="outlined" startIcon={<TuneRoundedIcon />} onClick={() => { setRascunho(valores); setAberto(true); }} sx={{ textTransform: "none", fontWeight: 600, borderRadius: "999px" }}>
            Filtros
          </Button>
        </Badge>
      )}

      <AppDrawer
        open={aberto}
        onClose={() => setAberto(false)}
        title="Filtros"
        subtitle="Refine o relatório"
        icon={<TuneRoundedIcon />}
        width={440}
        confirmDiscard={false}
        footer={
          <>
            <Button onClick={() => setRascunho(limparPainel(rascunho))} disabled={campos.every((c) => vazio(valorDe(rascunho, c.id)))}>Limpar</Button>
            <Stack direction="row" spacing={1.5}>
              <Button onClick={() => setAberto(false)} variant="outlined">Cancelar</Button>
              <Button
                onClick={() => {
                  onChange(campos.reduce((acc, c) => ({ ...acc, [c.id]: valorDe(rascunho, c.id) }), valores));
                  setAberto(false);
                }}
                variant="contained"
                disableElevation
                sx={{ fontWeight: 700 }}
              >
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
              return (
                <TextField
                  key={c.id}
                  select
                  size="small"
                  label={c.label}
                  value={c.multi ? (Array.isArray(atual) ? atual : []) : (atual ?? "")}
                  onChange={(e) => setRascunho({ ...rascunho, [c.id]: e.target.value })}
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
                      {c.multi ? <ListItemText primary={o.label} /> : o.label}
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
