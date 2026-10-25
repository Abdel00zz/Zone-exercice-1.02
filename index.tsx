import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './paperThemes.css';
import 'katex/dist/katex.min.css';
import ErrorBoundary from './components/ErrorBoundary';

// 🔧 IMPORTANT : Import du fichier CSS pour l'impression
import './styles/print.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Le service worker de production fournit l'installation et le cache hors ligne.
// Il reste désactivé en développement pour ne jamais servir un bundle obsolète à Vite/HMR.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => registration.update())
      .catch((error) => console.warn('Service worker indisponible', error));
  });
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
