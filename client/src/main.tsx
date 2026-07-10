import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import ServerGate from './components/ServerGate';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ServerGate>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ServerGate>
    </QueryClientProvider>
  </StrictMode>
);
