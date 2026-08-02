import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { MathJaxContext } from 'better-react-mathjax';

// 🔧 IMPORTANT : Import du fichier CSS pour l'impression
import './styles/print.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// PWA : permet l'installation sur l'écran d'accueil et un fonctionnement hors-ligne minimal.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const config = {
  loader: { load: ["input/tex", "output/svg", "[tex]/ams", "[tex]/color", "[tex]/textmacros"] },
  tex: {
    packages: { '[+]': ['ams', 'color', 'textmacros'] },
    inlineMath: [
      ["$", "$"],
      ["\\(", "\\)"],
    ],
    displayMath: [
      ["$$", "$$"],
      ["\\[", "\\]"],
    ],
  },
  svg: {
    fontCache: 'global' // Améliore les performances de rendu SVG
  },
};

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <MathJaxContext config={config}>
        <App />
      </MathJaxContext>
    </ErrorBoundary>
  </React.StrictMode>
);