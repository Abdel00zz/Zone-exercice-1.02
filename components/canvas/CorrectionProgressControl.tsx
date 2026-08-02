import React from 'react';
import type { CorrectionProgress } from './types';

/** Contrôleur unique, compact et tactile de la progression de l'aide. */
const CorrectionProgressControl: React.FC<{ progress: CorrectionProgress }> = ({ progress }) => (
  <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-indigo-100 bg-indigo-50/90 p-0.5" aria-label="Progression de l'aide">
    <button type="button" onClick={progress.reset} disabled={progress.step === 1} className="h-8 min-w-8 rounded-full text-xs text-slate-500 disabled:opacity-25" aria-label="Recommencer l'aide">↺</button>
    <button type="button" onClick={progress.previous} disabled={progress.step === 1} className="h-8 min-w-8 rounded-full text-sm text-slate-600 disabled:opacity-25" aria-label="Étape précédente de l'aide">‹</button>
    <span className="min-w-10 text-center text-xs font-bold text-indigo-950" aria-live="polite">{progress.step}/{progress.maxStep}</span>
    <button type="button" onClick={progress.next} disabled={progress.step === progress.maxStep} className="h-8 min-w-8 rounded-full bg-indigo-600 text-base text-white disabled:bg-indigo-100 disabled:text-indigo-300" aria-label="Étape suivante de l'aide">›</button>
  </div>
);

export default React.memo(CorrectionProgressControl);
