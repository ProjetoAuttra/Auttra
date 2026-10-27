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

type AppDialogProps = Omit<DialogProps, "title"> & {
  title: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "simple" | "entity";
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  onCloseClick?: () => void;
};

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
  ...props
}: AppDialogProps) {

  const handleClose: DialogProps["onClose"] = (event, reason) => {
    if (reason === "backdropClick" && !closeOnBackdrop) return;
    if (reason === "escapeKeyDown" && !closeOnEscape) return;
    onClose?.(event, reason);
  };

  const handleCloseButton = () => {
    if (onCloseClick) {
      onCloseClick();
      return;
    }
    onClose?.({} as React.SyntheticEvent, "escapeKeyDown");
  };

  return (
    <Dialog
      fullWidth
      onClose={handleClose}
      PaperProps={{
        ...PaperProps,
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
