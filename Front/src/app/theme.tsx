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

// Escala única de raios: controles 6, cards/tabelas/diálogos 8, chips 4. `pill` só para barras de progresso.
// shape.borderRadius = 4: no `sx`, borderRadius 1 = 4px, 1.5 = 6px, 2 = 8px.
export const radius = { control: 6, card: 8, dialog: 8, chip: 4, pill: 999 } as const;

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
    background: { default: '#FFFFFF', paper: brand.surface },
    // Hover/fundo suave também usado em painéis sem borda ("soltos").
    action: { hover: '#F4F6FA' },
    text: { primary: brand.ink, secondary: brand.muted },
    divider: brand.line,
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: '"Inter Variable", "Inter", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    fontSize: 14,
    h4: { fontWeight: 700, fontSize: '1.75rem', lineHeight: 1.2, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.25, letterSpacing: '-0.02em' },
    h6: { fontWeight: 650, fontSize: '1.125rem', lineHeight: 1.3, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 600, fontSize: '1rem', letterSpacing: '-0.005em' },
    subtitle2: { fontWeight: 600, fontSize: '0.875rem' },
    body1: { fontSize: '0.9375rem', lineHeight: 1.5 },
    body2: { fontSize: '0.875rem', lineHeight: 1.45 },
    caption: { fontSize: '0.75rem', lineHeight: 1.4 },
    overline: { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1.4 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Reserva o espaço da barra de rolagem: o layout não "pula" entre telas curtas e longas.
        html: { scrollbarGutter: 'stable' },
        body: { fontFeatureSettings: '"cv11", "ss01"' },
      },
    },
    // Escala de ícones: small 18, medium 22, large 28 (antes 20/24/35).
    MuiSvgIcon: {
      styleOverrides: {
        fontSizeSmall: { fontSize: '1.125rem' },
        fontSizeMedium: { fontSize: '1.375rem' },
        fontSizeLarge: { fontSize: '1.75rem' },
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
    // Rótulo sempre flutuante: campos com e sem ícone ficam iguais.
    MuiTextField: { defaultProps: { size: 'small', InputLabelProps: { shrink: true } } },
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
      // Painéis `outlined` não têm contorno: viram um bloco de fundo suave.
      variants: [
        { props: { variant: 'outlined' }, style: { border: 0, backgroundColor: '#F4F6FA' } },
      ],
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
        root: { borderRadius: radius.chip, fontWeight: 600, fontSize: 12 },
        sizeSmall: { height: 22 },
      },
      // Chips preenchidos são "tonais" (fundo claro, texto escuro): leitura de status sem gritar.
      variants: [
        { props: { variant: 'filled', color: 'default' }, style: { backgroundColor: brand.subtleStrong, color: '#475569' } },
        { props: { variant: 'filled', color: 'primary' }, style: { backgroundColor: brand.primarySoft, color: brand.primaryDark } },
        { props: { variant: 'filled', color: 'success' }, style: { backgroundColor: '#ECFDF5', color: '#047857' } },
        { props: { variant: 'filled', color: 'warning' }, style: { backgroundColor: '#FFFBEB', color: '#B45309' } },
        { props: { variant: 'filled', color: 'error' }, style: { backgroundColor: '#FEF2F2', color: '#B91C1C' } },
        { props: { variant: 'filled', color: 'info' }, style: { backgroundColor: '#F0F9FF', color: '#0369A1' } },
      ],
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: brand.muted,
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          backgroundColor: 'transparent',
          letterSpacing: '0.04em',
        },
        // Cabeçalho fixo precisa de fundo opaco, senão as linhas rolam por baixo dele.
        stickyHeader: {
          backgroundColor: '#FFFFFF',
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
          borderRadius: radius.card,
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
