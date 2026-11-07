import { ThemeProvider, CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { theme } from './theme';
import { AuthProvider } from '../context/AuthContext';
import { SystemResourcesProvider } from '../context/SystemResourcesContext';
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3} autoHideDuration={3000}>
        <AuthProvider>
          <SystemResourcesProvider>{children}</SystemResourcesProvider>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}
