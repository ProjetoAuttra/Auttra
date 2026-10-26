import { Box, Typography } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const HeaderIcon = styled(Box)(({ theme }) => ({
  width: 38,
  height: 38,
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
  color: "#fff",
  flexShrink: 0,
  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.35)}`,
  "& svg": { fontSize: 20 },
}));

export const SectionLabel = styled(Typography)(({ theme }) => ({
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: theme.palette.text.disabled,
  marginBottom: theme.spacing(1.5),
}));

export const PlacaDisplay = styled(Box)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(
    theme.palette.primary.main,
    0.04
  )})`,
  border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
  borderRadius: 8,
  padding: "6px 14px",
  fontFamily: "'Courier New', monospace",
  fontWeight: 700,
  fontSize: 18,
  letterSpacing: "0.12em",
  color: theme.palette.primary.main,
  minWidth: 130,
  minHeight: 42,
}));

export const PrecoDisplay = styled(Box)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "baseline",
  gap: 4,
  padding: "6px 14px",
  borderRadius: 8,
  background: alpha(theme.palette.success.main, 0.08),
  border: `1.5px solid ${alpha(theme.palette.success.main, 0.2)}`,
}));
