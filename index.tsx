import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { MathJaxContext } from 'better-react-mathjax';

// 🔧 IMPORTANT : Import du fichier CSS pour l'impression
import './styles/print.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const config = {
  loader: { load: ["input/tex", "output/svg"] }, // Changé de 'chtml' à 'svg' pour une qualité vectorielle
  tex: {
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
    <MathJaxContext config={config}>
      <App />
    </MathJaxContext>
  </React.StrictMode>
);