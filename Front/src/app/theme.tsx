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
  // Neutros de superfície: cabeçalho de tabela, painéis internos e controles segmentados.
  subtle: '#F8FAFC',
  subtleStrong: '#F1F5F9',
  // Tons de apoio do azul (fundos de ícone, selecionado, hover) e cores de status.
  primarySoft: '#EEF2FF',
  primaryTint: '#DBEAFE',
  primaryBorder: '#BFDBFE',
  success: '#059669',
  error: '#DC2626',
  info: '#0284C7',
};

// Escala única de raios: controles, cards/tabelas, diálogos e pílulas (chips/badges).
export const radius = { control: 8, card: 12, dialog: 16, pill: 999 } as const;

// Sombras discretas: o app é flat com borda fina; sombra só em elementos flutuantes.
export const shadows = {
  card: '0 1px 2px rgba(16, 24, 40, 0.04)',
  raised: '0 4px 12px rgba(16, 24, 40, 0.08)',
  floating: '0 16px 40px rgba(16, 24, 40, 0.14)',
} as const;

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: brand.primary, light: brand.primaryLight, dark: brand.primaryDark, contrastText: '#ffffff' },
    secondary: { main: brand.teal, light: '#2DD4BF', dark: '#115E59', contrastText: '#ffffff' },
    warning: { main: brand.amber, light: '#FBBF24', dark: '#B45309', contrastText: '#111827' },
    success: { main: brand.success },
    error: { main: brand.error },
    info: { main: brand.info },
    background: { default: brand.page, paper: brand.surface },
    text: { primary: brand.ink, secondary: brand.muted },
    divider: brand.line,
  },
  shape: { borderRadius: radius.control },
  typography: {
    fontFamily: '"Inter Variable", "Inter", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    fontSize: 14,
    h4: { fontWeight: 700, fontSize: '1.75rem', lineHeight: 1.2, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.25, letterSpacing: '-0.02em' },
    h6: { fontWeight: 650, fontSize: '1.125rem', lineHeight: 1.3, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 600, fontSize: '1rem', letterSpacing: '-0.005em' },
    subtitle2: { fontWeight: 600, fontSize: '0.875rem' },
    body1: { fontSize: '0.9375rem' },
    body2: { fontSize: '0.875rem' },
    caption: { fontSize: '0.75rem' },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontFeatureSettings: '"cv11", "ss01"' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: radius.control, minHeight: 40, paddingInline: 16 },
        sizeSmall: { minHeight: 32, paddingInline: 12 },
        sizeLarge: { minHeight: 48 },
        containedPrimary: {
          background: brand.primary,
          '&:hover': { background: brand.primaryDark },
        },
        outlined: {
          borderColor: brand.line,
          color: brand.ink,
          '&:hover': { borderColor: brand.primary, backgroundColor: brand.primarySoft },
        },
      },
    },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radius.control,
          backgroundColor: '#FFFFFF',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: brand.line },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#B8C2D0' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: brand.primary, borderWidth: 1.5 },
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
        rounded: { borderRadius: radius.card },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: radius.card,
          border: `1px solid ${brand.line}`,
          boxShadow: shadows.card,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: radius.pill, fontWeight: 600, fontSize: 12 },
        sizeSmall: { height: 22 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: brand.muted,
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          backgroundColor: brand.subtle,
          letterSpacing: '0.04em',
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
            backgroundColor: brand.primarySoft,
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
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: radius.dialog, boxShadow: shadows.floating },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: radius.control + 2,
          border: `1px solid ${brand.line}`,
          boxShadow: shadows.floating,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: brand.ink, fontSize: 12, fontWeight: 500, borderRadius: 6 },
        arrow: { color: brand.ink },
      },
    },
    MuiAppBar: { styleOverrides: { colorPrimary: { backgroundColor: brand.surface } } },
  },
});
