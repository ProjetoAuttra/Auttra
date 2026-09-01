import { createTheme } from '@mui/material/styles';

export const brand = {
  ink: '#18202F',
  muted: '#667085',
  primary: '#1D4ED8',
  primaryLight: '#60A5FA',
  primaryDark: '#173EA5',
  teal: '#047481',
  amber: '#D97706',
  surface: '#FFFFFF',
  page: '#F5F7FA',
  line: '#DDE3EA',
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: brand.primary, light: brand.primaryLight, dark: brand.primaryDark, contrastText: '#ffffff' },
    secondary: { main: brand.teal, light: '#2DD4BF', dark: '#115E59', contrastText: '#ffffff' },
    warning: { main: brand.amber, light: '#FBBF24', dark: '#B45309', contrastText: '#111827' },
    background: { default: brand.page, paper: brand.surface },
    text: { primary: brand.ink, secondary: brand.muted },
    divider: brand.line,
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    h4: { fontWeight: 760, letterSpacing: 0 },
    h5: { fontWeight: 740, letterSpacing: 0 },
    h6: { fontWeight: 720, letterSpacing: 0 },
    subtitle1: { fontWeight: 650, letterSpacing: 0 },
    button: { textTransform: 'none', fontWeight: 700, letterSpacing: 0 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, minHeight: 42 },
        containedPrimary: {
          background: brand.primary,
          '&:hover': {
            background: brand.primaryDark,
          },
        },
      },
    },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: '#FFFFFF',
        },
      },
    },
    MuiIconButton: { defaultProps: { size: 'small' } },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderColor: brand.line,
          boxShadow: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: `1px solid rgba(255,255,255,0.78)`,
          boxShadow: '0 18px 46px rgba(16, 24, 40, 0.08)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 650 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: brand.muted,
          fontSize: 12,
          fontWeight: 800,
          textTransform: 'uppercase',
          backgroundColor: '#F7F9FC',
          letterSpacing: 0,
        },
        root: {
          borderBottomColor: brand.line,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&.MuiTableRow-hover:hover': {
            backgroundColor: '#F8FAFC',
          },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 6,
          border: `1px solid ${brand.line}`,
          boxShadow: '0 18px 40px rgba(16, 24, 40, 0.12)',
        },
      },
    },
    MuiAppBar: { styleOverrides: { colorPrimary: { backgroundColor: brand.surface } } },
  },
});
