import React, { useEffect, useState } from 'react';
import { 
  Settings, Type, Sigma, UserRound, CalendarDays, PenTool, X, 
  Folder, Pencil, Trash2, ChevronUp, ChevronDown, 
  RotateCcw, Check, GraduationCap, Plus, BookOpen
} from 'lucide-react';
import type { AppConfiguration, PaperTheme, Worksheet } from '../types';
import { MATHJAX_FONTS, resolveMathJaxFont } from '../utils/mathjaxFonts';
import { DEFAULT_OFFICIAL_CLASSES } from '../utils/worksheetUtils';
import { PAPER_THEME_OPTIONS, resolvePaperTheme } from '../utils/paperThemes';
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

interface ConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  configuration: AppConfiguration;
  onSave: (configuration: AppConfiguration) => void;
  worksheetClasses?: string[];
  worksheets?: Worksheet[];
  onCreateClass?: (name: string) => void;
  onRenameClass?: (previousName: string, nextName: string) => void;
  onDeleteClass?: (className: string) => void;
  onReorderClasses?: (newClasses: string[]) => void;
  onResetClasses?: () => void;
}

const ConfigurationModal: React.FC<ConfigurationModalProps> = ({
  isOpen,
  onClose,
  configuration,
  onSave,
  worksheetClasses = DEFAULT_OFFICIAL_CLASSES,
  worksheets = [],
  onCreateClass,
  onRenameClass,
  onDeleteClass,
  onReorderClasses,
  onResetClasses,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'classes'>('general');
  const [draft, setDraft] = useState(configuration);
  
  // Class management state
  const [editingClassIndex, setEditingClassIndex] = useState<number | null>(null);
  const [editingClassName, setEditingClassName] = useState('');
  const [newClassInput, setNewClassInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDraft({
        ...configuration,
        mathFont: resolveMathJaxFont(configuration.mathFont),
        handwritingFont: configuration.handwritingFont || "'Playwrite FR Trad', 'Caveat', cursive",
        paperTheme: resolvePaperTheme(configuration.paperTheme),
      });
      setEditingClassIndex(null);
      setNewClassInput('');
    }
  }, [configuration, isOpen]);

  if (!isOpen) return null;

  const update = <K extends keyof AppConfiguration>(key: K, value: AppConfiguration[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleStartRename = (index: number, currentName: string) => {
    setEditingClassIndex(index);
    setEditingClassName(currentName);
  };

  const handleSaveRename = (previousName: string) => {
    const trimmed = editingClassName.trim();
    if (trimmed && trimmed !== previousName && onRenameClass) {
      onRenameClass(previousName, trimmed);
    }
    setEditingClassIndex(null);
    setEditingClassName('');
  };

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newClassInput.trim();
    if (trimmed && onCreateClass) {
      onCreateClass(trimmed);
      setNewClassInput('');
    }
  };

  const handleMoveClass = (index: number, direction: 'up' | 'down') => {
    if (!onReorderClasses) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= worksheetClasses.length) return;
    
    const updated = [...worksheetClasses];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    onReorderClasses(updated);
  };

  const getWorksheetCountForClass = (className: string) => {
    return worksheets.filter((w) => w.content?.settings?.className?.trim() === className).length;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172126]/35 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="configuration-title">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-[24px] border border-[#dedbd2] bg-[#fffefa] shadow-2xl flex flex-col" onClick={(event) => event.stopPropagation()}>
        
        {/* En-tête avec onglets */}
        <header className="shrink-0 border-b border-[#dedbd2] bg-[#fffefa] px-5 pt-4 pb-0 sm:px-6">
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#dceceb] text-[#19788c]"><Settings className="h-5 w-5" /></span>
              <div>
                <h2 id="configuration-title" className="font-serif text-xl font-semibold text-[#172126]">Configuration Générale</h2>
                <p className="text-xs font-medium text-[#697478]">Réglages, typographies et structure officielle des classes.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full text-[#697478] hover:bg-[#f4f1eb]" aria-label="Fermer"><X className="h-5 w-5" /></button>
          </div>

          {/* Navigation par Onglets */}
          <div className="flex gap-2 pt-2 border-t border-[#e8ece7]">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors ${
                activeTab === 'general'
                  ? 'border-[#19788c] text-[#19788c]'
                  : 'border-transparent text-[#697478] hover:text-[#172126]'
              }`}
            >
              <Type className="h-4 w-4" />
              Général & Polices
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('classes')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors ${
                activeTab === 'classes'
                  ? 'border-[#19788c] text-[#19788c]'
                  : 'border-transparent text-[#697478] hover:text-[#172126]'
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              Gestion des Classes
              <span className="ml-1.5 rounded-full bg-[#dceceb] px-2 py-0.5 text-[10px] font-bold text-[#19788c]">
                {worksheetClasses.length}
              </span>
            </button>
          </div>
        </header>

        {/* Formulaire Général & Polices */}
        {activeTab === 'general' && (
          <form onSubmit={(event) => { event.preventDefault(); onSave({ ...draft, userName: draft.userName.trim(), schoolYear: draft.schoolYear.trim() }); }} className="flex flex-col flex-grow overflow-hidden">
            <div className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-grow custom-scrollbar">
              <section className="grid gap-4 sm:grid-cols-2">
                <label className="rounded-2xl border border-[#dedbd2] bg-[#fbf8f2] p-3 sm:p-4"><span className="mb-2 flex items-center gap-2 text-[13px] font-bold text-[#435054]"><UserRound className="h-4 w-4 text-[#19788c]" />Nom utilisateur</span><input value={draft.userName} onChange={(event) => update('userName', event.target.value)} placeholder="Votre nom" className="w-full bg-transparent text-sm font-semibold text-[#172126] outline-none placeholder:text-[#9aa1a1]" /></label>
                <label className="rounded-2xl border border-[#dedbd2] bg-[#fbf8f2] p-3 sm:p-4"><span className="mb-2 flex items-center gap-2 text-[13px] font-bold text-[#435054]"><CalendarDays className="h-4 w-4 text-[#b88700]" />Année scolaire</span><input value={draft.schoolYear} onChange={(event) => update('schoolYear', event.target.value)} placeholder="2026-2027" className="w-full bg-transparent text-sm font-semibold text-[#172126] outline-none placeholder:text-[#9aa1a1]" /></label>
              </section>

              <section className="rounded-2xl border border-[#dedbd2] bg-[#fbf8f2] p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e2ddd0] text-[#435054]"><BookOpen className="h-4 w-4" /></span><div><h3 className="text-sm font-bold text-[#172126]">Thème du Papier</h3><p className="text-xs text-[#697478]">Couleur de fond et style visuel global de la fiche.</p></div></div>
                <div className="grid gap-5">
                  <label className="text-[13px] font-bold text-[#435054] flex flex-col gap-1.5">Style de page
                    <select value={resolvePaperTheme(draft.paperTheme)} onChange={(event) => update('paperTheme', event.target.value as PaperTheme)} className="w-full rounded-xl border border-[#dedbd2] bg-white h-11 px-3 text-sm font-semibold text-[#172126] outline-none focus:ring-2 focus:ring-[#19788c]/20">
                      {PAPER_THEME_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                </div>
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
        )}

        {/* Gestionnaire de Classes Ultra Avancé */}
        {activeTab === 'classes' && (
          <div className="flex flex-col flex-grow overflow-hidden">
            <div className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-grow custom-scrollbar">
              
              {/* Entête explication + Ajouter une classe */}
              <div className="rounded-2xl border border-[#cbe0df] bg-[#f1f8f7] p-4 sm:p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#172126] flex items-center gap-2">
                      <GraduationCap className="h-4.5 w-4.5 text-[#19788c]" />
                      Liste Officielle des Classes
                    </h3>
                    <p className="text-xs text-[#697478] mt-1 leading-relaxed">
                      Gérez les classes affichées dans l'arborescence (Tronc Commun, 1ère & 2ème Bac). Renommer une classe met à jour automatiquement toutes les fiches qui lui sont associées.
                    </p>
                  </div>
                  {onResetClasses && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Réinitialiser la liste aux classes officielles par défaut (Tronc Commun & Bac) ?")) {
                          onResetClasses();
                        }
                      }}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-[#cbe0df] bg-white px-3 py-1.5 text-xs font-bold text-[#19788c] hover:bg-[#dceceb] transition active:scale-95 shadow-2xs"
                      title="Restaurer les classes officielles par défaut"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Réinitialiser
                    </button>
                  )}
                </div>

                {/* Formulaire d'ajout rapide */}
                <form onSubmit={handleAddClass} className="pt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={newClassInput}
                    onChange={(e) => setNewClassInput(e.target.value)}
                    placeholder="Nouvelle classe (ex: Tronc Commun Scientifique 2, 2nde B...)"
                    className="flex-1 h-10 rounded-xl border border-[#cbe0df] bg-white px-3 text-xs sm:text-sm font-semibold text-[#172126] outline-none focus:ring-2 focus:ring-[#19788c]/20"
                  />
                  <button
                    type="submit"
                    disabled={!newClassInput.trim()}
                    className="shrink-0 h-10 inline-flex items-center gap-1.5 rounded-xl bg-[#19788c] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#11677a] disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </button>
                </form>
              </div>

              {/* Liste interactive des classes */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#697478]">
                  Classes configurées ({worksheetClasses.length})
                </span>

                {worksheetClasses.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#dedbd2] p-8 text-center text-xs text-[#697478]">
                    Aucune classe configurée. Utilisez le champ ci-dessus pour en ajouter ou réinitialisez la liste.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {worksheetClasses.map((clsName, index) => {
                      const isEditing = editingClassIndex === index;
                      const count = getWorksheetCountForClass(clsName);

                      return (
                        <div
                          key={`${clsName}_${index}`}
                          className="flex items-center justify-between gap-2 rounded-2xl border border-[#e8ece7] bg-white p-3 shadow-2xs hover:border-[#cbe0df] transition"
                        >
                          {/* Flèches de réordonnancement + Nom de classe */}
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            {onReorderClasses && (
                              <div className="flex flex-col shrink-0">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => handleMoveClass(index, 'up')}
                                  className="text-[#9aa1a1] hover:text-[#19788c] disabled:opacity-20 p-0.5"
                                  title="Monter"
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === worksheetClasses.length - 1}
                                  onClick={() => handleMoveClass(index, 'down')}
                                  className="text-[#9aa1a1] hover:text-[#19788c] disabled:opacity-20 p-0.5"
                                  title="Descendre"
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}

                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#e7f0ef] text-[#19788c]">
                              <Folder className="h-4 w-4" />
                            </span>

                            {isEditing ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="text"
                                  value={editingClassName}
                                  onChange={(e) => setEditingClassName(e.target.value)}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveRename(clsName);
                                    } else if (e.key === 'Escape') {
                                      setEditingClassIndex(null);
                                    }
                                  }}
                                  className="flex-1 h-9 rounded-xl border border-[#19788c] bg-white px-3 text-xs sm:text-sm font-bold text-[#172126] outline-none focus:ring-2 focus:ring-[#19788c]/20"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveRename(clsName)}
                                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#19788c] text-white hover:bg-[#11677a]"
                                  title="Valider"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingClassIndex(null)}
                                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e8ece7] text-[#697478] hover:bg-[#d8ded6]"
                                  title="Annuler"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="font-bold text-xs sm:text-sm text-[#172126] truncate">
                                  {clsName}
                                </span>
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f4f1eb] px-2 py-0.5 text-[10px] font-bold text-[#697478]">
                                  <BookOpen className="h-3 w-3 text-[#19788c]" />
                                  {count} fiche{count !== 1 ? 's' : ''}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Boutons d'action Éditer / Supprimer */}
                          {!isEditing && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartRename(index, clsName)}
                                className="grid h-8 w-8 place-items-center rounded-xl text-[#697478] hover:bg-[#e7f0ef] hover:text-[#19788c] transition"
                                title="Renommer la classe"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              {onDeleteClass && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const confirmMsg = count > 0 
                                      ? `Supprimer la classe « ${clsName} » ? Les ${count} fiche(s) associée(s) passeront en « Non classé ».`
                                      : `Supprimer la classe « ${clsName} » ?`;
                                    if (window.confirm(confirmMsg)) {
                                      onDeleteClass(clsName);
                                    }
                                  }}
                                  className="grid h-8 w-8 place-items-center rounded-xl text-[#697478] hover:bg-red-50 hover:text-red-600 transition"
                                  title="Supprimer la classe"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            <footer className="shrink-0 flex justify-end border-t border-[#dedbd2] px-5 py-4 bg-[#fffefa]">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-[#172126] px-6 h-11 text-sm font-bold text-white shadow-md hover:bg-[#25363c] transition-colors active:scale-95"
              >
                Fermer
              </button>
            </footer>
          </div>
        )}

      </div>
    </div>
  );
};

export default ConfigurationModal;
