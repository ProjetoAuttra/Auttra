import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#111827", contrastText: "#ffffff" },
    secondary: { main: "#6b7280" },
    background: { default: "#f9fafb", paper: "#ffffff" },
    text: { primary: "#111827", secondary: "#6b7280" },
    divider: "#e5e7eb",
    error: { main: "#dc2626" },
    success: { main: "#16a34a" },
    warning: { main: "#d97706" },
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
    button: { textTransform: "none", fontWeight: 500, letterSpacing: 0 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true, variant: "outlined" },
      styleOverrides: {
        root: { borderRadius: 6, minHeight: 36, fontSize: 14 },
        containedPrimary: {
          backgroundColor: "#111827",
          color: "#ffffff",
          "&:hover": { backgroundColor: "#1f2937" },
        },
        outlinedPrimary: {
          borderColor: "#d1d5db",
          color: "#111827",
          "&:hover": { backgroundColor: "#f3f4f6", borderColor: "#9ca3af" },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid #e5e7eb",
          boxShadow: "none",
        },
      },
    },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 6, backgroundColor: "#ffffff", fontSize: 14 },
        notchedOutline: { borderColor: "#d1d5db" },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#6b7280",
          backgroundColor: "#f9fafb",
          borderBottom: "1px solid #e5e7eb",
        },
        root: { borderBottomColor: "#f3f4f6", fontSize: 14 },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&.MuiTableRow-hover:hover": { backgroundColor: "#f9fafb" },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 4, fontSize: 12, fontWeight: 500 },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          boxShadow: "none",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          border: "none",
          borderRight: "1px solid #e5e7eb",
          boxShadow: "none",
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontSize: 14,
          "&.Mui-selected": {
            backgroundColor: "#f3f4f6",
            color: "#111827",
            fontWeight: 600,
            "&:hover": { backgroundColor: "#e5e7eb" },
          },
          "&:hover": { backgroundColor: "#f9fafb" },
        },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: "#e5e7eb" } },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { border: "1px solid #e5e7eb", borderRadius: 8 },
      },
    },
    MuiAlert: {
      defaultProps: { variant: "outlined" },
      styleOverrides: {
        root: { borderRadius: 6, fontSize: 13, alignItems: "center", padding: "6px 12px" },
        outlinedError: { backgroundColor: "#fef2f2", borderColor: "#fecaca", color: "#dc2626" },
        outlinedSuccess: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0", color: "#16a34a" },
        outlinedWarning: { backgroundColor: "#fffbeb", borderColor: "#fde68a", color: "#d97706" },
        outlinedInfo: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe", color: "#2563eb" },
      },
    },
    MuiSnackbar: {
      defaultProps: { anchorOrigin: { vertical: "bottom", horizontal: "right" } },
    },
  },
});
