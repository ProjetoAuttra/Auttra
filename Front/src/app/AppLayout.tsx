import { Box, Toolbar } from '@mui/material';
import { Outlet } from 'react-router-dom';
import AppSidebar from '../components/layout/AppSidebar';
import AppTopbar from '../components/layout/AppTopbar';
import { useState } from 'react';
import { useSidebar } from '../context/SidebarContext';
import { ToastProvider } from '../context/ToastContext';
import { ConfirmProvider } from '../context/ConfirmContext';

export default function AppLayout() {
  const drawerWidth = 248;
  const collapsedWidth = 68;
  const [mobileOpen, setMobileOpen] = useState(false);
  const { collapsed } = useSidebar();

  const currentWidth = collapsed ? collapsedWidth : drawerWidth;

  return (
    <ToastProvider>
      <ConfirmProvider>
        <Box
          sx={{
            display: 'flex',
            minHeight: '100dvh',
            bgcolor: 'background.default',
          }}
        >
          <AppTopbar onMenuClick={() => setMobileOpen(true)} />
          <AppSidebar
            drawerWidth={drawerWidth}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              ml: { xs: 0, md: `${currentWidth}px` },
              width: { xs: '100%', md: `calc(100% - ${currentWidth}px)` },
              minHeight: '100dvh',
              transition: 'all 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'background.default',
              overflow: 'hidden',
            }}
          >
            <Toolbar sx={{ minHeight: { xs: 64, md: 88 }, flexShrink: 0 }} />
            <Box
              sx={{
                flexGrow: 1,
                width: '100%',
                maxWidth: 1500,
                mx: 'auto',
                px: { xs: 1.5, sm: 2.5, md: 4 },
                pt: { xs: 1.5, md: 2 },
                pb: { xs: 3, md: 4 },
                overflow: 'auto',
              }}
            >
              <Outlet />
            </Box>
          </Box>
        </Box>
      </ConfirmProvider>
    </ToastProvider>
  );
}
