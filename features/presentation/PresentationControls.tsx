import { ArrowLeft, ArrowRight, LayoutDashboard, Maximize } from 'lucide-react';

interface PresentationControlsProps {
  index: number;
  count: number;
  onPrevious: () => void;
  onNext: () => void;
  onBack: () => void;
}

export function PresentationControls({ index, count, onPrevious, onNext, onBack }: PresentationControlsProps) {
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* A browser may decline fullscreen; navigation remains available. */ }
  };
  return (
    <nav className="presentation-controls no-print sticky top-0 z-30 mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-b-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm" aria-label="Navigation du diaporama">
      <button type="button" onClick={onBack} aria-label="Revenir aux fiches" className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
        <LayoutDashboard size={18} /><span className="hidden sm:inline">Mes fiches</span>
      </button>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onPrevious} disabled={index <= 0} aria-label="Question précédente" className="grid min-h-11 min-w-11 place-items-center rounded-lg bg-slate-100 text-slate-800 disabled:opacity-30"><ArrowLeft size={20} /></button>
        <span role="status" aria-live="polite" className="min-w-28 text-center text-sm font-semibold text-slate-700">{count ? index + 1 : 0} / {count}</span>
        <button type="button" onClick={onNext} disabled={index >= count - 1} aria-label="Question suivante" className="grid min-h-11 min-w-11 place-items-center rounded-lg bg-slate-800 text-white disabled:opacity-30"><ArrowRight size={20} /></button>
      </div>
      <button type="button" onClick={() => void toggleFullscreen()} aria-label="Activer ou quitter le plein écran" className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-700 hover:bg-slate-100"><Maximize size={20} /></button>
    </nav>
  );
}
