import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Font biểu tượng được đóng gói từ npm
import '@phosphor-icons/web/regular';
import '@phosphor-icons/web/fill';
import '@phosphor-icons/web/bold';
import '@phosphor-icons/web/duotone';
import './index.css';
import App from './app/App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
