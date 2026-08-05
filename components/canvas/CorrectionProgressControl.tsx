import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CorrectionProgress } from './types';

/** Contrôleur compact et harmonieux de la progression des étapes d'aide (sans bouton reset). */
const CorrectionProgressControl: React.FC<{ progress: CorrectionProgress }> = ({ progress }) => (
  <div className="inline-flex items-center gap-0.5 bg-amber-50/90 backdrop-blur-xs rounded-full border border-amber-200/90 px-1 py-0.5 shadow-2xs" aria-label="Progression de l'aide">
    <button
      type="button"
      onClick={progress.previous}
      disabled={progress.step === 1}
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-amber-800 hover:bg-amber-200/60 disabled:opacity-30 disabled:hover:bg-transparent transition active:scale-90"
      aria-label="Étape précédente de l'aide"
      title="Étape précédente"
    >
      <ChevronLeft size={13} className="stroke-[2.5]" />
    </button>
    <span className="px-1 text-[11px] font-bold text-amber-900 select-none min-w-[24px] text-center" aria-live="polite">
      {progress.step}/{progress.maxStep}
    </span>
    <button
      type="button"
      onClick={progress.next}
      disabled={progress.step === progress.maxStep}
      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-200/70 disabled:text-amber-400 transition active:scale-90 shadow-2xs"
      aria-label="Étape suivante de l'aide"
      title="Étape suivante"
    >
      <ChevronRight size={13} className="stroke-[2.5]" />
    </button>
  </div>
);

export default React.memo(CorrectionProgressControl);
