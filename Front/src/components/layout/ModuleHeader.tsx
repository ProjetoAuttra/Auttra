import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type React from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FileUploadRoundedIcon from "@mui/icons-material/FileUploadRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

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
  actions?: React.ReactNode;
};

export default function ModuleHeader({
  title,
  subtitle,
  icon,
  searchValue,
  searchPlaceholder = "Pesquisar",
  onSearchChange,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionIcon,
  actions,
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
            {icon && <Box sx={{ color: "text.secondary", display: "flex", "& svg": { fontSize: 24 } }}>{icon}</Box>}
            <Box minWidth={0}>
              <Typography variant="h5" sx={{ fontSize: { xs: 22, md: 24 }, lineHeight: 1.15, fontWeight: 700 }}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {subtitle}
              </Typography>
            </Box>
          </Stack>

        </Stack>

        {actions && <Box sx={{ minWidth: 0 }}>{actions}</Box>}

        {(onAction || onSecondaryAction) && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="stretch">
            {onSecondaryAction && (
              <Button
                variant="outlined"
                startIcon={secondaryActionIcon ?? <FileUploadRoundedIcon />}
                onClick={onSecondaryAction}
                sx={{ px: 2.5, whiteSpace: "nowrap" }}
              >
                {secondaryActionLabel}
              </Button>
            )}
            {onAction && (
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={onAction} sx={{ px: 2.5 }}>
                {actionLabel}
              </Button>
            )}
          </Stack>
        )}
      </Stack>

      {/* Busca da lista: aparece sempre que a página passa onSearchChange. */}
      {onSearchChange && (
        <TextField
          size="small"
          fullWidth
          placeholder={searchPlaceholder}
          value={searchValue ?? ""}
          onChange={(e) => onSearchChange(e.target.value)}
          inputProps={{ "aria-label": searchPlaceholder }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" sx={{ color: "text.disabled" }} />
              </InputAdornment>
            ),
            endAdornment: searchValue ? (
              <InputAdornment position="end">
                <IconButton size="small" aria-label="Limpar busca" onClick={() => onSearchChange("")} edge="end">
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{ mt: 2 }}
        />
      )}
    </Box>
  );
}
