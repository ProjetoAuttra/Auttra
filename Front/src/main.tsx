import '@fontsource-variable/inter';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import Providers from './app/providers';
import { SidebarProvider } from './context/SidebarContext';
import { ClientProvider } from './context/ClientContext';

// Import only when environment variable is true
if (import.meta.env.VITE_USE_MOCK_DATA === 'true') {
  import('./api/mockApi').then(() => {
    console.log('Mock API is active.');
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidebarProvider>
      <Providers>
        <BrowserRouter>
          <ClientProvider>
            <App />
          </ClientProvider>
        </BrowserRouter>
      </Providers>
    </SidebarProvider>
  </React.StrictMode>
);