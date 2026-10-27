import * as React from "react";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { alpha } from "@mui/material/styles";
import type { DialogProps, DialogActionsProps, DialogContentProps } from "@mui/material";
import { useConfirm } from "../../context/ConfirmContext";

type AppDialogProps = Omit<DialogProps, "title"> & {
  title: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "simple" | "entity";
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  onCloseClick?: () => void;
  /** Pede confirmação ao fechar quando o usuário alterou algo no formulário. Padrão: ligado. */
  confirmDiscard?: boolean;
};

// Cliques que alteram valor sem disparar input/change no DOM (Select, menus, calendário).
const VALUE_PICKER_SELECTOR = '[role="option"], [role="menuitem"], [role="gridcell"] button, .MuiPickersDay-root';

export function AppDialog({
  title,
  icon,
  variant: _variant = "simple",
  children,
  PaperProps,
  closeOnBackdrop = true,
  closeOnEscape = true,
  onClose,
  onCloseClick,
  confirmDiscard = true,
  ...props
}: AppDialogProps) {
  const confirm = useConfirm();
  const dirtyRef = React.useRef(false);

  // Cada abertura começa limpa; salvar fecha o modal pelo pai (open=false) e zera também.
  React.useEffect(() => {
    if (!props.open) dirtyRef.current = false;
  }, [props.open]);

  const markDirty = () => {
    dirtyRef.current = true;
  };

  const requestClose = async (close: () => void) => {
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
    close();
  };

  const handleClose: DialogProps["onClose"] = (event, reason) => {
    if (reason === "backdropClick" && !closeOnBackdrop) return;
    if (reason === "escapeKeyDown" && !closeOnEscape) return;
    void requestClose(() => onClose?.(event, reason));
  };

  const handleCloseButton = () => {
    void requestClose(() => {
      if (onCloseClick) onCloseClick();
      else onClose?.({} as React.SyntheticEvent, "escapeKeyDown");
    });
  };

  return (
    <Dialog
      fullWidth
      onClose={handleClose}
      PaperProps={{
        ...PaperProps,
        onInputCapture: markDirty,
        onChangeCapture: markDirty,
        onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
          if ((event.target as HTMLElement).closest?.(VALUE_PICKER_SELECTOR)) markDirty();
        },
        sx: {
          overflow: "hidden",
          ...((PaperProps?.sx as object) ?? {}),
        },
      }}
      {...props}
    >
      <Box
        sx={{
          px: { xs: 2.5, sm: 3 },
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
          {icon && (
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor: "primary.main",
                color: "#fff",
                boxShadow: (t) => `0 4px 12px ${alpha(t.palette.primary.main, 0.24)}`,
                flexShrink: 0,
                "& svg": { fontSize: 24 },
              }}
            >
              {icon}
            </Box>
          )}
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.3} noWrap>
            {title}
          </Typography>
        </Box>
        <IconButton onClick={handleCloseButton} size="small">
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      {children}
    </Dialog>
  );
}

export function AppDialogContent({ sx, ...props }: DialogContentProps) {
  return <DialogContent sx={{ px: { xs: 2.5, sm: 3 }, py: 2, ...sx }} {...props} />;
}

export function AppDialogActions({ sx, ...props }: DialogActionsProps) {
  return (
    <DialogActions
      sx={{
        px: 3,
        py: 2,
        ...sx,
      }}
      {...props}
    />
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      fontWeight={700}
      color="text.secondary"
      sx={{ textTransform: "uppercase", letterSpacing: 0.8, display: "block", mb: 1.5 }}
    >
      {children}
    </Typography>
  );
}
