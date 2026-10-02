import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import { App } from './App';

if (import.meta.env.VITE_DEMO === 'true') {
  const { installMockServer } = await import('./demo/mockServer');
  installMockServer();
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
