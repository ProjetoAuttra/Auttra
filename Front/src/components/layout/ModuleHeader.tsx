import {
  Box,
  Button,
  Stack,
  Typography,
} from "@mui/material";
import type React from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import FileUploadRoundedIcon from "@mui/icons-material/FileUploadRounded";

type Metric = {
  label: string;
  value: string | number;
  tone?: "primary" | "success" | "warning" | "error" | "neutral";
};

type Props = {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  metrics?: Metric[];
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryActionIcon?: React.ReactNode;
};

export default function ModuleHeader({
  title,
  subtitle,
  icon,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionIcon,
}: Props) {
  return (
    <Box
      sx={{
        mb: 2.25,
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", md: "center" }}
        justifyContent="space-between"
      >
        <Stack spacing={1} minWidth={0}>
          <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
            {icon && <Box sx={{ color: "primary.main", display: "flex", "& svg": { fontSize: 24 } }}>{icon}</Box>}
            <Box minWidth={0}>
              <Typography variant="h5" sx={{ fontSize: { xs: 22, md: 24 }, lineHeight: 1.15, fontWeight: 850 }}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {subtitle}
              </Typography>
            </Box>
          </Stack>

        </Stack>

        {(onAction || onSecondaryAction) && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="stretch">
            {onSecondaryAction && (
              <Button
                variant="outlined"
                startIcon={secondaryActionIcon ?? <FileUploadRoundedIcon />}
                onClick={onSecondaryAction}
                sx={{ borderRadius: 999, px: 2.5, whiteSpace: "nowrap" }}
              >
                {secondaryActionLabel}
              </Button>
            )}
            {onAction && (
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={onAction} sx={{ borderRadius: 999, px: 2.5 }}>
                {actionLabel}
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
