import * as React from "react";
import { Box, Button, InputAdornment, Skeleton, Stack, Switch, TextField, Typography, type TextFieldProps } from "@mui/material";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import ModuleHeader from "../../../components/layout/ModuleHeader";
import FalhaCarregamento from "../../../components/common/FalhaCarregamento";

const borda = (t: { palette: { divider: string } }) => `1px solid ${t.palette.divider}`;

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
  /** Quantas linhas o esqueleto mostra enquanto carrega. */
  linhasEsqueleto?: number;
  children: React.ReactNode;
};

/**
 * Casco das seções de Configurações, no mesmo padrão de Recursos adicionais: campos sempre editáveis,
 * "Salvar alterações" no cabeçalho (ativo só quando algo mudou) e uma configuração por linha.
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
  linhasEsqueleto = 3,
  children,
}: SecaoProps) {
  const prontoParaEditar = podeEditar && !carregando && !falhou;
  return (
    <Box data-testid={`section-${secao}`}>
      <ModuleHeader
        title={titulo}
        subtitle={subtitulo}
        icon={icone}
        actions={
          prontoParaEditar ? (
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              {alterado && (
                <Button variant="text" color="inherit" data-testid={`descartar-${secao}`} onClick={onDescartar} disabled={salvando}>
                  Descartar
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<SaveRoundedIcon />}
                data-testid={`save-${secao}`}
                onClick={onSalvar}
                disabled={!alterado || salvando}
              >
                Salvar alterações
              </Button>
            </Stack>
          ) : undefined
        }
      />

      {carregando ? (
        <EsqueletoLinhas linhas={linhasEsqueleto} />
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
          sx={{ borderBottom: borda }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
}

type LinhaProps = {
  titulo: string;
  descricao?: React.ReactNode;
  /** Controle (campo, switch...) à direita; com `largo`, vai para baixo do texto ocupando a linha toda. */
  children: React.ReactNode;
  largo?: boolean;
};

/** Uma configuração: o que é e para que serve à esquerda, o controle à direita. */
export function LinhaConfiguracao({ titulo, descricao, children, largo = false }: LinhaProps) {
  return (
    <Box
      sx={{
        py: 2.25,
        borderTop: borda,
        display: "grid",
        gap: { xs: 1.5, md: largo ? 1.5 : 4 },
        alignItems: "center",
        gridTemplateColumns: largo ? "1fr" : { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 400px)" },
      }}
    >
      <Box minWidth={0}>
        <Typography fontWeight={700}>{titulo}</Typography>
        {descricao && (
          <Typography variant="body2" color="text.secondary">
            {descricao}
          </Typography>
        )}
      </Box>
      <Box minWidth={0}>{children}</Box>
    </Box>
  );
}

/** Switch com o texto "Ativo/Inativo" ao lado, igual ao de Recursos adicionais. */
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
    <Stack direction="row" alignItems="center" justifyContent={{ xs: "flex-start", md: "flex-end" }} spacing={1}>
      <Typography variant="body2" fontWeight={600} color={checked ? "success.main" : "text.secondary"} sx={{ minWidth: 52, textAlign: "right" }}>
        {checked ? "Ativo" : "Inativo"}
      </Typography>
      <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} slotProps={{ input: { role: "switch", "aria-label": rotulo } as React.InputHTMLAttributes<HTMLInputElement> }} />
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
      value={Number.isNaN(valor) ? "" : valor}
      onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
      InputProps={{ endAdornment: <InputAdornment position="end">{unidade}</InputAdornment>, ...props.InputProps }}
    />
  );
}

function EsqueletoLinhas({ linhas }: { linhas: number }) {
  return (
    <Box role="status" aria-label="Carregando" sx={{ borderBottom: borda }}>
      {Array.from({ length: linhas }).map((_, i) => (
        <Box
          key={i}
          sx={{
            py: 2.25,
            borderTop: borda,
            display: "grid",
            gap: { xs: 1.5, md: 4 },
            alignItems: "center",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 400px)" },
          }}
        >
          <Box>
            <Skeleton variant="text" width={180} height={24} />
            <Skeleton variant="text" width={i % 2 ? "70%" : "55%"} height={20} />
          </Box>
          <Skeleton variant="rounded" height={40} />
        </Box>
      ))}
    </Box>
  );
}
