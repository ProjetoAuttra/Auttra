import * as React from "react";
import { Tooltip, Typography, type TypographyProps } from "@mui/material";

type Props = Omit<TypographyProps, "children"> & {
  texto: string;
  /** Máximo de linhas visíveis; o restante é cortado com reticências. */
  linhas?: number;
};

/**
 * Texto que quebra em até `linhas` linhas e, se algo ficou escondido, mostra o texto completo ao passar o mouse.
 * O corte é medido no momento do hover, então acompanha a largura real da coluna.
 */
export default function TextoLimitado({ texto, linhas = 2, sx, ...props }: Props) {
  const ref = React.useRef<HTMLElement | null>(null);
  const [cortado, setCortado] = React.useState(false);

  const medir = () => {
    const el = ref.current;
    if (!el) return;
    setCortado(el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
  };

  return (
    <Tooltip title={cortado ? texto : ""} placement="top-start" enterDelay={300}>
      <Typography
        ref={ref}
        onMouseEnter={medir}
        sx={[
          {
            display: "-webkit-box",
            WebkitLineClamp: linhas,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            overflowWrap: "anywhere",
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
        {...props}
      >
        {texto}
      </Typography>
    </Tooltip>
  );
}
