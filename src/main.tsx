import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/design-system/theme/index.css.ts';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
