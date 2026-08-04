import React, { useEffect, useState } from 'react';
import { Settings, Type, Sigma, UserRound, CalendarDays, PenTool, X } from 'lucide-react';
import type { AppConfiguration } from '../types';
import { MATHJAX_FONTS, resolveMathJaxFont } from '../utils/mathjaxFonts';
import MathText from './MathText';

const TEXT_FONTS = [
  { label: 'Latin Modern Roman (LaTeX Standard)', value: "'Latin Modern Roman', 'Computer Modern', 'CMU Serif', 'Lora', Georgia, serif" },
  { label: 'Latin Modern Sans (LaTeX Beamer)', value: "'Latin Modern Sans', 'CMU Sans Serif', 'Plus Jakarta Sans', 'Fira Sans', sans-serif" },
  { label: 'STIX Two Academic Publication', value: "'STIX Two Text', 'EB Garamond', Georgia, serif" },
  { label: 'EB Garamond (Classique & Édition)', value: "'EB Garamond', 'Lora', Georgia, serif" },
  { label: 'Lora Academic Serif', value: "Lora, 'EB Garamond', Georgia, serif" },
  { label: 'Cormorant Garamond (Livre Mathématiques)', value: "'Cormorant Garamond', 'EB Garamond', Georgia, serif" },
  { label: 'Source Serif 4 (Clarté Scientifique)', value: "'Source Serif 4', Georgia, serif" },
  { label: 'Alegreya (Littéraire & Académique)', value: "'Alegreya', 'Lora', Georgia, serif" },
  { label: 'Fira Sans Math / Beamer', value: "'Fira Sans', 'Plus Jakarta Sans', sans-serif" },
  { label: 'Plus Jakarta Modern Sans', value: "'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif" },
  { label: 'Quicksand', value: "Quicksand, 'Segoe UI', Arial, sans-serif" },
];

const HANDWRITING_FONTS = [
  { label: 'Playwrite FR Trad (Scolaire Cursive FR)', value: "'Playwrite FR Trad', 'Caveat', cursive" },
  { label: 'Playwrite FR Moderne (Cursive Récente)', value: "'Playwrite FR Moderne', 'Caveat', cursive" },
  { label: 'Playwrite IT Moderne (Cursive Italienne)', value: "'Playwrite IT Moderne', 'Caveat', cursive" },
  { label: 'Caveat (Moderne & Fluide)', value: "'Caveat', cursive" },
  { label: 'Kalam (Manuscrit Rond)', value: "'Kalam', cursive" },
  { label: 'Marck Script (Plume Élégante)', value: "'Marck Script', cursive" },
  { label: 'Neucha (Créatif & Expressif)', value: "'Neucha', cursive" },
  { label: 'Patrick Hand (Écriture au Crayon)', value: "'Patrick Hand', cursive" },
  { label: 'Itim (Rond & Enfantin)', value: "'Itim', cursive" },
  { label: 'Gochi Hand (Clair & Naturel)', value: "'Gochi Hand', cursive" },
  { label: 'Pacifico (Rétro & Doux)', value: "'Pacifico', cursive" },
];

const ConfigurationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  configuration: AppConfiguration;
  onSave: (configuration: AppConfiguration) => void;
}> = ({ isOpen, onClose, configuration, onSave }) => {
  const [draft, setDraft] = useState(configuration);

  useEffect(() => {
    if (isOpen) {
      setDraft({
        ...configuration,
        mathFont: resolveMathJaxFont(configuration.mathFont),
        handwritingFont: configuration.handwritingFont || "'Playwrite FR Trad', 'Caveat', cursive",
      });
    }
  }, [configuration, isOpen]);

  if (!isOpen) return null;

  const update = <K extends keyof AppConfiguration>(key: K, value: AppConfiguration[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172126]/35 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="configuration-title">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-[24px] border border-[#dedbd2] bg-[#fffefa] shadow-2xl flex flex-col" onClick={(event) => event.stopPropagation()}>
        <header className="flex shrink-0 items-center justify-between border-b border-[#dedbd2] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#dceceb] text-[#19788c]"><Settings className="h-5 w-5" /></span>
            <div><h2 id="configuration-title" className="font-serif text-xl font-semibold text-[#172126]">Configuration</h2><p className="text-xs font-medium text-[#697478]">Réglages utilisés par vos fiches.</p></div>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full text-[#697478] hover:bg-[#f4f1eb]" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </header>
        <form onSubmit={(event) => { event.preventDefault(); onSave({ ...draft, userName: draft.userName.trim(), schoolYear: draft.schoolYear.trim() }); }} className="flex flex-col flex-grow overflow-hidden">
          <div className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-grow">
            <section className="grid gap-4 sm:grid-cols-2">
              <label className="rounded-2xl border border-[#dedbd2] bg-[#fbf8f2] p-3 sm:p-4"><span className="mb-2 flex items-center gap-2 text-[13px] font-bold text-[#435054]"><UserRound className="h-4 w-4 text-[#19788c]" />Nom utilisateur</span><input value={draft.userName} onChange={(event) => update('userName', event.target.value)} placeholder="Votre nom" className="w-full bg-transparent text-sm font-semibold text-[#172126] outline-none placeholder:text-[#9aa1a1]" /></label>
              <label className="rounded-2xl border border-[#dedbd2] bg-[#fbf8f2] p-3 sm:p-4"><span className="mb-2 flex items-center gap-2 text-[13px] font-bold text-[#435054]"><CalendarDays className="h-4 w-4 text-[#b88700]" />Année scolaire</span><input value={draft.schoolYear} onChange={(event) => update('schoolYear', event.target.value)} placeholder="2026-2027" className="w-full bg-transparent text-sm font-semibold text-[#172126] outline-none placeholder:text-[#9aa1a1]" /></label>
            </section>
            
            <section className="rounded-2xl border border-[#cbe0df] bg-[#f1f8f7] p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#dceceb] text-[#19788c]"><Type className="h-4 w-4" /></span><div><h3 className="text-sm font-bold text-[#172126]">Texte de la fiche</h3><p className="text-xs text-[#697478]">Police et taille des énoncés, titres et questions.</p></div></div>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="text-[13px] font-bold text-[#435054] flex flex-col gap-1.5">Police du texte
                  <select value={draft.textFont} onChange={(event) => update('textFont', event.target.value)} className="w-full rounded-xl border border-[#cbe0df] bg-white h-11 px-3 text-sm font-semibold text-[#172126] outline-none focus:ring-2 focus:ring-[#19788c]/20">
                    {TEXT_FONTS.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}
                  </select>
                </label>
                <label className="text-[13px] font-bold text-[#435054] flex flex-col gap-1.5">Taille : {draft.textScale}%
                  <input type="range" min="80" max="130" step="5" value={draft.textScale} onChange={(event) => update('textScale', Number(event.target.value))} className="mt-2 w-full accent-[#19788c]" />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-[#e5dcb8] bg-[#fbf4dc] p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f0e6c2] text-[#b88700]"><Sigma className="h-4 w-4" /></span><div><h3 className="text-sm font-bold text-[#172126]">MathJax 4</h3><p className="text-xs text-[#697478]">Choisissez la police de rendu des formules mathématiques TeX/LaTeX.</p></div></div>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="text-[13px] font-bold text-[#435054] flex flex-col gap-1.5">Police MathJax
                  <select value={resolveMathJaxFont(draft.mathFont)} onChange={(event) => update('mathFont', event.target.value)} className="w-full rounded-xl border border-[#e5dcb8] bg-white h-11 px-3 text-sm font-semibold text-[#172126] outline-none focus:ring-2 focus:ring-[#b88700]/20">
                    {MATHJAX_FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
                  </select>
                </label>
                <label className="text-[13px] font-bold text-[#435054] flex flex-col gap-1.5">Taille des formules : {draft.mathScale}%
                  <input type="range" min="80" max="140" step="5" value={draft.mathScale} onChange={(event) => update('mathScale', Number(event.target.value))} className="mt-2 w-full accent-[#b88700]" />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-[#e2d5ed] bg-[#f8f3fc] p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eadef5] text-[#7e3af2]"><PenTool className="h-4 w-4" /></span><div><h3 className="text-sm font-bold text-[#172126]">Écriture Manuscrite (Indices & Corrigés)</h3><p className="text-xs text-[#697478]">Style d'écriture manuscrite pour les aides et rappels.</p></div></div>
              <div>
                <label className="text-[13px] font-bold text-[#435054] flex flex-col gap-1.5">Police manuscrite
                  <select value={draft.handwritingFont || "'Playwrite FR Trad', 'Caveat', cursive"} onChange={(event) => update('handwritingFont', event.target.value)} className="w-full rounded-xl border border-[#e2d5ed] bg-white h-11 px-3 text-sm font-semibold text-[#172126] outline-none focus:ring-2 focus:ring-[#7e3af2]/20">
                    {HANDWRITING_FONTS.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}
                  </select>
                </label>
                <div className="mt-4 p-3.5 rounded-xl bg-white border border-[#e2d5ed]/80 shadow-sm">
                  <p className="text-[11px] font-semibold text-[#697478] mb-1.5 uppercase tracking-wide">Aperçu du texte d'aide</p>
                  <p className="text-[15px] text-[#1e3a8a]" style={{ fontFamily: draft.handwritingFont || "'Playwrite FR Trad', 'Caveat', cursive" }}>
                    <MathText text="Rappel : Pour $x \neq 0$, la dérivée de $\ln(x)$ est $\frac{1}{x}$." />
                  </p>
                </div>
              </div>
            </section>
          </div>
          <footer className="shrink-0 flex justify-end gap-3 border-t border-[#dedbd2] px-5 py-4 bg-[#fffefa]">
            <button type="button" onClick={onClose} className="rounded-xl px-5 h-11 text-sm font-bold text-[#697478] hover:bg-[#f4f1eb] transition-colors">Annuler</button>
            <button type="submit" className="rounded-xl bg-[#172126] px-6 h-11 text-sm font-bold text-white shadow-md hover:bg-[#25363c] transition-colors active:scale-95">Enregistrer</button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default ConfigurationModal;
