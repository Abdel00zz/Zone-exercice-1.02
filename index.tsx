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
  output: {
    // Latin Modern est la famille mathématique la plus proche du rendu MathPlus.
    // Les textes placés dans \text{...} restent cohérents avec l'interface.
    font: 'mathjax-modern',
    mtextInheritFont: true,
    merrorInheritFont: true,
    unknownFamily: 'Quicksand, Segoe UI, sans-serif',
  },
  svg: {
    fontCache: 'global', // Réutilise les glyphes entre toutes les formules.
    blacker: 1.5, // Trait plus fin que la valeur MathJax par défaut (3).
  },
};

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <MathJaxContext
        version={4}
        src="https://cdn.jsdelivr.net/npm/mathjax@4/startup.js"
        config={config}
      >
        <App />
      </MathJaxContext>
    </ErrorBoundary>
  </React.StrictMode>
);
