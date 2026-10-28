import * as React from "react";
import { Box, Drawer, IconButton, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { alpha } from "@mui/material/styles";
import { useConfirm } from "../../context/ConfirmContext";

type AppDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  /** Largura em telas médias para cima; no celular ocupa a tela toda. */
  width?: number;
  /** Rodapé fixo (botões). Use <DrawerActions> para o padrão: ação destrutiva à esquerda, Cancelar e a principal à direita. */
  footer?: React.ReactNode;
  /** Pede confirmação ao fechar quando o usuário alterou algo no formulário. Padrão: ligado. */
  confirmDiscard?: boolean;
  children: React.ReactNode;
};

// Cliques que alteram valor sem disparar input/change no DOM (Select, menus, calendário).
const VALUE_PICKER_SELECTOR = '[role="option"], [role="menuitem"], [role="gridcell"] button, .MuiPickersDay-root';

/**
 * Painel lateral para cadastros e edições: cabeçalho com ícone e título, corpo rolável e rodapé fixo.
 * Mantém a lista visível ao fundo. Substitui o modal centralizado nos formulários curtos.
 */
export function AppDrawer({ open, onClose, title, subtitle, icon, width = 520, footer, confirmDiscard = true, children }: AppDrawerProps) {
  const confirm = useConfirm();
  const dirtyRef = React.useRef(false);

  // Cada abertura começa limpa; salvar fecha o painel pelo pai (open=false) e zera também.
  React.useEffect(() => {
    if (!open) dirtyRef.current = false;
  }, [open]);

  const requestClose = async () => {
    if (confirmDiscard && dirtyRef.current) {
      const discard = await confirm({
        title: "Descartar alterações?",
        message: "O que você preencheu neste formulário será perdido.",
        confirmLabel: "Descartar",
        cancelLabel: "Continuar editando",
        variant: "warning",
      });
      if (!discard) return;
    }
    dirtyRef.current = false;
    onClose();
  };

  const markDirty = () => {
    dirtyRef.current = true;
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => void requestClose()}
      // Mesmo nível do modal: aberto de dentro de um modal (ex.: cadastrar cliente a partir do veículo), aparece por cima.
      sx={{ zIndex: (t) => t.zIndex.modal }}
      PaperProps={{
        onInputCapture: markDirty,
        onChangeCapture: markDirty,
        onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
          if ((event.target as HTMLElement).closest?.(VALUE_PICKER_SELECTOR)) markDirty();
        },
        sx: { width: { xs: "100%", sm: width }, maxWidth: "100%", display: "flex", flexDirection: "column" },
      }}
    >
      <Box sx={{ px: 3, py: 2.5, display: "flex", alignItems: "center", gap: 1.5, borderBottom: (t) => `1px solid ${t.palette.divider}` }}>
        {icon && (
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
              color: "primary.main",
              "& svg": { fontSize: 24 },
            }}
          >
            {icon}
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" fontWeight={700} lineHeight={1.25} noWrap>{title}</Typography>
          {subtitle && <Typography variant="body2" color="text.secondary" noWrap>{subtitle}</Typography>}
        </Box>
        <IconButton onClick={() => void requestClose()} size="small" aria-label="Fechar">
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 3 }}>{children}</Box>

      {footer && (
        <Box sx={{ px: 3, py: 2, borderTop: (t) => `1px solid ${t.palette.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
          {footer}
        </Box>
      )}
    </Drawer>
  );
}

/** Seção do formulário: título em negrito com linha fina embaixo e os campos em seguida. */
export function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 4, "&:last-of-type": { mb: 0 } }}>
      <Typography fontWeight={700} sx={{ pb: 1, mb: 2, borderBottom: (t) => `1px solid ${t.palette.divider}` }}>{title}</Typography>
      {children}
    </Box>
  );
}
