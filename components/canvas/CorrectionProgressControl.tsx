import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CorrectionProgress } from './types';

/** Contrôleur compact et harmonieux de la progression des étapes d'aide (sans bouton reset). */
const CorrectionProgressControl: React.FC<{ progress: CorrectionProgress }> = ({ progress }) => (
  <div className="inline-flex items-center gap-0.5 bg-[#fbf9f4] backdrop-blur-md rounded-full border border-[#19788c]/80 px-1 py-0.5 h-[26px] shadow-2xs font-itim" aria-label="Progression de l'aide">
    <button
      type="button"
      onClick={progress.previous}
      disabled={progress.step === 1}
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[#19788c] hover:bg-[#e0f2fe] disabled:opacity-30 disabled:hover:bg-transparent transition active:scale-90"
      aria-label="Étape précédente de l'aide"
      title="Étape précédente"
    >
      <ChevronLeft size={13} className="stroke-[2.5]" />
    </button>
    <span className="px-1 text-[0.8rem] font-bold text-[#19788c] select-none min-w-[24px] text-center font-itim" aria-live="polite">
      {progress.step}/{progress.maxStep}
    </span>
    <button
      type="button"
      onClick={progress.next}
      disabled={progress.step === progress.maxStep}
      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#19788c] text-white hover:bg-[#0284c7] disabled:bg-[#19788c]/20 disabled:text-[#19788c]/40 transition active:scale-90 shadow-2xs"
      aria-label="Étape suivante de l'aide"
      title="Étape suivante"
    >
      <ChevronRight size={13} className="stroke-[2.5]" />
    </button>
  </div>
);

export default React.memo(CorrectionProgressControl);
