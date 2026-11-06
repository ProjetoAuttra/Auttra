import * as React from "react";
import { Box, Button, Card, InputAdornment, Skeleton, Stack, Switch, TextField, Typography, type TextFieldProps } from "@mui/material";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import ModuleHeader from "../../../components/layout/ModuleHeader";
import FalhaCarregamento from "../../../components/common/FalhaCarregamento";

const borda = (t: { palette: { divider: string } }) => `1px solid ${t.palette.divider}`;

/** Largura máxima dos cartões: em tela larga eles não esticam até a borda. */
const LARGURA_MAXIMA = 880;

/** Colunas de uma configuração dentro do cartão: rótulo numa coluna fixa e o campo logo ao lado. */
const colunasLinha = { xs: "1fr", md: "280px minmax(0, 1fr)" };

type SecaoProps = {
  secao: string;
  titulo: string;
  subtitulo: string;
  icone: React.ReactNode;
  /** Ex.: "Configurações de agenda" — usado na mensagem de falha. */
  registro: string;
  carregando: boolean;
  falhou: boolean;
  onTentarNovamente: () => void;
  alterado: boolean;
  salvando: boolean;
  podeEditar: boolean;
  onSalvar: () => void;
  onDescartar: () => void;
  /** Formato do esqueleto enquanto carrega: quantas linhas em cada cartão. Ex.: [2, 1]. */
  esqueleto?: number[];
  /** Os cartões da seção (`CartaoConfiguracao`). */
  children: React.ReactNode;
};

/**
 * Casco das seções de Configurações: campos sempre editáveis, agrupados em cartões por assunto,
 * com "Descartar" e "Salvar alterações" (ativo só quando algo mudou) no fim.
 */
export default function SecaoConfiguracao({
  secao,
  titulo,
  subtitulo,
  icone,
  registro,
  carregando,
  falhou,
  onTentarNovamente,
  alterado,
  salvando,
  podeEditar,
  onSalvar,
  onDescartar,
  esqueleto = [2, 1],
  children,
}: SecaoProps) {
  return (
    <Box data-testid={`section-${secao}`} sx={{ maxWidth: LARGURA_MAXIMA }}>
      <ModuleHeader title={titulo} subtitle={subtitulo} icon={icone} />

      {carregando ? (
        <EsqueletoCartoes cartoes={esqueleto} />
      ) : falhou ? (
        <FalhaCarregamento motivo="erro" registro={registro} feminino onTentarNovamente={onTentarNovamente} />
      ) : (
        <Box
          component="form"
          data-testid={`content-${secao}`}
          noValidate
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            if (alterado && !salvando) onSalvar();
          }}
        >
          <Stack spacing={2.5}>{children}</Stack>

          {podeEditar && (
            <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center" sx={{ mt: 2.5 }}>
              {alterado && (
                <Button variant="text" color="inherit" data-testid={`descartar-${secao}`} onClick={onDescartar} disabled={salvando}>
                  Descartar
                </Button>
              )}
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveRoundedIcon />}
                data-testid={`save-${secao}`}
                disabled={!alterado || salvando}
              >
                Salvar alterações
              </Button>
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
}

/** Um assunto da seção ("Funcionamento", "Prazos"...): título no topo e as configurações dele embaixo. */
export function CartaoConfiguracao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <Card component="section" aria-label={titulo}>
      <Box sx={{ px: { xs: 2, md: 3 }, py: 2, borderBottom: borda }}>
        <Typography fontWeight={700}>{titulo}</Typography>
        {descricao && (
          <Typography variant="body2" color="text.secondary">
            {descricao}
          </Typography>
        )}
      </Box>
      <Box sx={{ px: { xs: 2, md: 3 }, "& > * + *": { borderTop: borda } }}>{children}</Box>
    </Card>
  );
}

type LinhaProps = {
  titulo: string;
  descricao?: React.ReactNode;
  /** Controle (campo, switch...) ao lado do rótulo; com `largo`, vai para baixo ocupando a largura toda. */
  children: React.ReactNode;
  largo?: boolean;
};

/** Uma configuração dentro do cartão: rótulo e explicação curta, com o controle logo ao lado. */
export function LinhaConfiguracao({ titulo, descricao, children, largo = false }: LinhaProps) {
  return (
    <Box
      sx={{
        py: 2,
        display: "grid",
        columnGap: 3,
        rowGap: 1.25,
        alignItems: "center",
        gridTemplateColumns: largo ? "1fr" : colunasLinha,
      }}
    >
      <Box minWidth={0}>
        <Typography variant="body2" fontWeight={600}>
          {titulo}
        </Typography>
        {descricao && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.45 }}>
            {descricao}
          </Typography>
        )}
      </Box>
      <Box minWidth={0} sx={{ maxWidth: largo ? "none" : 440 }}>
        {children}
      </Box>
    </Box>
  );
}

/** Switch com o texto "Ativo/Inativo" ao lado. */
export function SwitchAtivo({
  checked,
  onChange,
  disabled,
  rotulo,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  rotulo: string;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} slotProps={{ input: { role: "switch", "aria-label": rotulo } as React.InputHTMLAttributes<HTMLInputElement> }} />
      <Typography variant="body2" fontWeight={600} color={checked ? "success.main" : "text.secondary"} sx={{ minWidth: 52 }}>
        {checked ? "Ativo" : "Inativo"}
      </Typography>
    </Stack>
  );
}

/** Campo numérico com a unidade no fim ("dias", "min", "%"). Vazio vira NaN, para a validação acusar. */
export function CampoNumero({
  valor,
  onChange,
  unidade,
  ...props
}: Omit<TextFieldProps, "value" | "onChange" | "type"> & { valor: number; onChange: (valor: number) => void; unidade: string }) {
  return (
    <TextField
      {...props}
      size="small"
      fullWidth
      type="number"
      sx={{ maxWidth: 240, ...props.sx }}
      value={Number.isNaN(valor) ? "" : valor}
      onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
      InputProps={{ endAdornment: <InputAdornment position="end">{unidade}</InputAdornment>, ...props.InputProps }}
    />
  );
}

function EsqueletoCartoes({ cartoes }: { cartoes: number[] }) {
  return (
    <Stack spacing={2.5} role="status" aria-label="Carregando">
      {cartoes.map((linhas, c) => (
        <Card key={c}>
          <Box sx={{ px: { xs: 2, md: 3 }, py: 2, borderBottom: borda }}>
            <Skeleton variant="text" width={160} height={24} />
          </Box>
          <Box sx={{ px: { xs: 2, md: 3 }, "& > * + *": { borderTop: borda } }}>
            {Array.from({ length: linhas }).map((_, i) => (
              <Box key={i} sx={{ py: 2, display: "grid", columnGap: 3, rowGap: 1.25, alignItems: "center", gridTemplateColumns: colunasLinha }}>
                <Box>
                  <Skeleton variant="text" width={150} height={20} />
                  <Skeleton variant="text" width="85%" height={16} />
                </Box>
                <Skeleton variant="rounded" height={40} sx={{ maxWidth: 440 }} />
              </Box>
            ))}
          </Box>
        </Card>
      ))}
    </Stack>
  );
}
