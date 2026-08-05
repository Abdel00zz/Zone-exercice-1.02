import React, { useState, useMemo } from 'react';
import type { Worksheet, WorksheetContent, QuestionPart, Exercise, AppConfiguration } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import { useCloudSync } from './hooks/useCloudSync';
import Dashboard from './components/Dashboard';
import ExerciseCard from './components/ExerciseCard';
import SettingsModal from './components/SettingsModal';
import EditableMathText from './components/EditableMathText';
import SyncPanel from './components/SyncPanel';
import CanvasFloatingToolbar from './components/canvas/FloatingToolbar';
import ConfigurationModal from './components/ConfigurationModal';
import { MathJaxContext } from 'better-react-mathjax';
import { DEFAULT_MATHJAX_FONT, resolveMathJaxFont } from './utils/mathjaxFonts';

import { initialJson } from "./data/initialWorksheet";
const createDefaultWorksheet = (): Worksheet => ({ id: "ws_default_3", name: initialJson.chapter || "Fiche de Démarrage", createdAt: new Date().toISOString(), content: initialJson }); const computeDefaultSchoolYear = (): string => { const now = new Date(); const year = now.getFullYear(); const month = now.getMonth(); const startYear = month >= 7 ? year : year - 1; return `${startYear}-${startYear + 1}`; };
const DEFAULT_CONFIGURATION: AppConfiguration = {
  userName: '',
  schoolYear: computeDefaultSchoolYear(),
  textFont: "'Latin Modern Roman', 'Computer Modern', 'CMU Serif', 'Lora', Georgia, serif",
  mathFont: DEFAULT_MATHJAX_FONT,
  handwritingFont: "'Playwrite FR Trad', 'Caveat', cursive",
  textScale: 100,
  mathScale: 100,
};

const App: React.FC = () => {
  const [worksheets, setWorksheets] = useLocalStorage<Worksheet[]>('worksheets', []);
  const [worksheetClasses, setWorksheetClasses] = useLocalStorage<string[]>('worksheet-classes', []);
  const [configuration, setConfiguration] = useLocalStorage<AppConfiguration>('app-configuration', DEFAULT_CONFIGURATION);
  const cloudSync = useCloudSync(worksheets, setWorksheets);
  const [isSyncPanelOpen, setIsSyncPanelOpen] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'worksheet'>('dashboard');
  const [selectedWorksheetId, setSelectedWorksheetId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isConfigurationOpen, setIsConfigurationOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const mathJaxFont = resolveMathJaxFont(configuration.mathFont);
  const mathJaxScale = Math.min(140, Math.max(80, configuration.mathScale)) / 100;
  const mathJaxConfig = useMemo(() => ({
    loader: { load: ['input/tex', 'output/svg', '[tex]/ams', '[tex]/color', '[tex]/textmacros'] },
    tex: {
      packages: { '[+]': ['ams', 'color', 'textmacros'] },
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
    },
    output: {
      font: mathJaxFont,
      scale: mathJaxScale,
      mtextInheritFont: true,
      merrorInheritFont: true,
      unknownFamily: 'Quicksand, Segoe UI, sans-serif',
    },
    svg: { fontCache: 'global', blacker: 1.5 },
  }), [mathJaxFont, mathJaxScale]);

  React.useEffect(() => {
    if (configuration.mathFont !== mathJaxFont) {
      setConfiguration((current) => ({ ...current, mathFont: mathJaxFont }));
    }
  }, [configuration.mathFont, mathJaxFont, setConfiguration]);

  React.useEffect(() => {
    setWorksheets(prev => (Array.isArray(prev) && prev.length > 0 ? prev : [createDefaultWorksheet()]));
  }, [setWorksheets]);

  // Les classes existent indépendamment des fiches : une classe vide reste donc
  // visible dans l'arborescence et peut être préparée à l'avance.
  React.useEffect(() => {
    const classesFromWorksheets = worksheets
      .map((worksheet) => worksheet.content.settings?.className?.trim())
      .filter((className): className is string => Boolean(className));
    if (classesFromWorksheets.length === 0) return;
    setWorksheetClasses((current) => {
      const next = Array.from(new Set([...current, ...classesFromWorksheets]));
      return next.length === current.length ? current : next;
    });
  }, [setWorksheetClasses, worksheets]);

  React.useEffect(() => {
    const handleQuotaWarning = (event: Event) => {
      const { size } = (event as CustomEvent<{ key: string; size: number }>).detail;
      const mb = (size / (1024 * 1024)).toFixed(1);
      setStorageWarning(`Le stockage local de vos fiches approche de la limite du navigateur (${mb} Mo). Pensez à exporter une sauvegarde JSON ou à activer la synchronisation cloud.`);
    };
    window.addEventListener('storage-quota-warning', handleQuotaWarning);
    return () => window.removeEventListener('storage-quota-warning', handleQuotaWarning);
  }, []);

  // Empêche l'écran de s'éteindre pendant une session d'écriture/dessin active sur la fiche.
  React.useEffect(() => {
    if (activeView !== 'worksheet' || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const requestWakeLock = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {
        // Refusé (batterie faible, onglet en arrière-plan...) : non bloquant.
      }
    };
    requestWakeLock();
    const handleVisibility = () => {
      if (!cancelled && document.visibilityState === 'visible' && !sentinel) requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      sentinel?.release().catch(() => {});
    };
  }, [activeView]);

  // Handle native browser back/forward buttons
  React.useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.view === 'worksheet' && event.state.id) {
        setSelectedWorksheetId(event.state.id);
        setActiveView('worksheet');
      } else {
        setActiveView('dashboard');
        setSelectedWorksheetId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectWorksheet = (id: string) => {
    setSelectedWorksheetId(id);
    setActiveView('worksheet');
    window.history.pushState({ view: 'worksheet', id }, '');
  };

  const handleBackToDashboard = () => {
    if (window.history.state && window.history.state.view === 'worksheet') {
      window.history.back();
    } else {
      setActiveView('dashboard');
      setSelectedWorksheetId(null);
    }
  };
  
  const handleAddWorksheet = (worksheet: Worksheet) => {
    setWorksheets(prev => [...prev, worksheet]);
  };

  const handleRestoreBackup = (backupWorksheets: Worksheet[]) => {
    if (window.confirm("Voulez-vous remplacer toutes vos fiches actuelles par cette sauvegarde ? (Annuler pour simplement les ajouter)")) {
      setWorksheets(backupWorksheets);
    } else {
      const newWorksheets = backupWorksheets.map(ws => ({
        ...ws,
        id: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }));
      setWorksheets(prev => [...prev, ...newWorksheets]);
    }
  };
  
  const handleDeleteWorksheet = (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette fiche ?")) {
      setWorksheets(prev => prev.filter(ws => ws.id !== id));
      if(selectedWorksheetId === id) {
          handleBackToDashboard();
      }
    }
  };

  const handleRenameWorksheet = (id: string, newName: string) => {
    // Ne renomme que la fiche : le chapitre reste indépendant pour permettre à plusieurs fiches de le partager.
    setWorksheets(prev => prev.map(ws =>
      ws.id === id ? { ...ws, name: newName } : ws
    ));
  };

  const handleUpdateWorksheetContent = (worksheetId: string, newContent: WorksheetContent) => {
    setWorksheets(prev => prev.map(ws => 
        ws.id === worksheetId 
        ? { ...ws, content: newContent } 
        : ws
    ));
  };

  const handleCreateClass = (name: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) return;
    setWorksheetClasses((current) => current.includes(normalizedName) ? current : [...current, normalizedName]);
  };

  const handleRenameClass = (previousName: string, nextName: string) => {
    const normalizedName = nextName.trim();
    if (!normalizedName || previousName === normalizedName) return;
    setWorksheetClasses((current) => Array.from(new Set(current.map((name) => name === previousName ? normalizedName : name))));
    setWorksheets((current) => current.map((worksheet) => (
      worksheet.content.settings?.className === previousName
        ? {
            ...worksheet,
            content: {
              ...worksheet.content,
              settings: { ...worksheet.content.settings, className: normalizedName },
            },
          }
        : worksheet
    )));
  };

  const handleDeleteClass = (className: string) => {
    setWorksheetClasses((current) => current.filter((name) => name !== className));
    setWorksheets((current) => current.map((worksheet) => (
      worksheet.content.settings?.className === className
        ? {
            ...worksheet,
            content: {
              ...worksheet.content,
              settings: { ...worksheet.content.settings, className: '' },
            },
          }
        : worksheet
    )));
  };

  const handleAssignWorksheetClass = (worksheetId: string, className: string) => {
    const normalizedName = className.trim();
    if (normalizedName) handleCreateClass(normalizedName);
    setWorksheets((current) => current.map((worksheet) => (
      worksheet.id === worksheetId
        ? {
            ...worksheet,
            content: {
              ...worksheet.content,
              settings: { ...worksheet.content.settings, className: normalizedName },
            },
          }
        : worksheet
    )));
  };
  
  /**
   * Applique `newProps` au nœud désigné par `path` en ne clonant que les nœuds
   * traversés. Remplace l'ancien `JSON.parse(JSON.stringify(...))` qui recopiait
   * la fiche entière (et tous les tracés) à chaque frappe ou trait de stylet.
   */
  const applyAtPath = (node: any, path: (string | number)[], newProps: object): any => {
    if (path.length === 0) return { ...node, ...newProps };
    const [key, ...rest] = path;
    if (node == null || node[key] === undefined) {
      throw new Error(`Chemin invalide au segment "${String(key)}"`);
    }
    const child = applyAtPath(node[key], rest, newProps);
    if (Array.isArray(node)) {
      const copy = node.slice();
      copy[key as number] = child;
      return copy;
    }
    return { ...node, [key]: child };
  };

  /**
   * Mise à jour d'un exercice de la fiche courante. La forme fonctionnelle est
   * indispensable : plusieurs canvas peuvent émettre dans le même tick, et lire
   * `selectedWorksheet` depuis la closure ferait perdre toutes les mises à jour
   * sauf la dernière.
   */
  const updateExercise = (exerciseId: string, mutate: (exercise: Exercise) => Exercise) => {
    setWorksheets(prev => prev.map(ws => {
      if (ws.id !== selectedWorksheetId) return ws;
      const exercises = ws.content?.exercises;
      if (!Array.isArray(exercises)) return ws;
      const index = exercises.findIndex(ex => ex.id === exerciseId);
      if (index === -1) return ws;
      try {
        const nextExercises = exercises.slice();
        nextExercises[index] = mutate(exercises[index]);
        return { ...ws, content: { ...ws.content, exercises: nextExercises } };
      } catch (error) {
        console.error("Mise à jour impossible pour l'exercice", exerciseId, error);
        return ws;
      }
    }));
  };

  const handleQuestionUpdate = (exerciseId: string, questionPath: (string | number)[], newProps: Partial<QuestionPart>) => {
    updateExercise(exerciseId, exercise => applyAtPath(exercise, questionPath, newProps));
  };

  const handleExerciseUpdate = (exerciseId: string, newProps: Partial<Exercise>) => {
    updateExercise(exerciseId, exercise => ({ ...exercise, ...newProps }));
  };

  const handleExerciseMergeUp = (exerciseId: string) => {
    setWorksheets(prev => prev.map(ws => {
      if (ws.id !== selectedWorksheetId) return ws;
      const exercises = ws.content?.exercises;
      if (!Array.isArray(exercises)) return ws;
      const index = exercises.findIndex(ex => ex.id === exerciseId);
      if (index <= 0) {
        if (index === 0) {
          // If it's the first exercise and it's empty, we just delete it
          const nextExercises = [...exercises];
          nextExercises.splice(index, 1);
          return { ...ws, content: { ...ws.content, exercises: nextExercises } };
        }
        return ws;
      }
      
      const nextExercises = [...exercises];
      const currentEx = nextExercises[index];
      const prevEx = nextExercises[index - 1];
      
      // Merge questions
      const mergedPrevEx = {
        ...prevEx,
        questions: [...(prevEx.questions || []), ...(currentEx.questions || [])]
      };
      
      nextExercises[index - 1] = mergedPrevEx;
      nextExercises.splice(index, 1);
      
      return { ...ws, content: { ...ws.content, exercises: nextExercises } };
    }));
  };

  const handleQuestionMergeUp = (exerciseId: string, questionPath: (string | number)[]) => {
    updateExercise(exerciseId, exercise => {
      if (!exercise.questions) return exercise;
      const pathStr = questionPath.join('.');
      
      // We only support merging up top-level questions for now
      if (questionPath.length === 1 && typeof questionPath[0] === 'number') {
        const index = questionPath[0];
        if (index > 0) {
          const nextQuestions = [...exercise.questions];
          const currentQ = nextQuestions[index];
          const prevQ = nextQuestions[index - 1];
          
          const mergedPrevQ = {
            ...prevQ,
            subquestions: [...(prevQ.subquestions || []), ...(currentQ.subquestions || [])]
          };
          
          nextQuestions[index - 1] = mergedPrevQ;
          nextQuestions.splice(index, 1);
          return { ...exercise, questions: nextQuestions };
        } else if (index === 0) {
          const nextQuestions = [...exercise.questions];
          nextQuestions.splice(index, 1);
          return { ...exercise, questions: nextQuestions };
        }
      }
      return exercise;
    });
  };

  const selectedWorksheet = useMemo(() => {
    return worksheets.find(ws => ws.id === selectedWorksheetId);
  }, [worksheets, selectedWorksheetId]);

  const exercises = useMemo(() => {
    if (!selectedWorksheet) {
      return [];
    }
    return selectedWorksheet.content.exercises || [];
  }, [selectedWorksheet]);

  const worksheetSettings = selectedWorksheet?.content.settings ?? {};
  const showCanvas = worksheetSettings.showCanvas !== false;
  const answerSpaceMinHeight = worksheetSettings.answerSpaceMinHeight;
  const answerSpaceStyle = worksheetSettings.answerSpaceStyle ?? 'slate';
  const answerSpaceColor = worksheetSettings.answerSpaceColor;
  const presentationMode = worksheetSettings.presentationMode ?? false;
  const oneQuestionPerPage = worksheetSettings.oneQuestionPerPage ?? false;
  const classNameLabel = (worksheetSettings.className ?? '').trim();
  const defaultSchoolYear = configuration.schoolYear || computeDefaultSchoolYear();
  const schoolYearLabel = (worksheetSettings.schoolYear ?? defaultSchoolYear).trim() || defaultSchoolYear;
  const userNameLabel = (worksheetSettings.userName ?? configuration.userName).trim();
  const textFont = worksheetSettings.textFont ?? configuration.textFont;
  const mathFont = resolveMathJaxFont(worksheetSettings.mathFont ?? configuration.mathFont);
  const handwritingFont = worksheetSettings.handwritingFont ?? configuration.handwritingFont ?? "'Playwrite FR Trad', 'Caveat', cursive";
  const textScale = worksheetSettings.textScale ?? configuration.textScale;
  const mathScale = worksheetSettings.mathScale ?? configuration.mathScale;
  const logoDataUrl = worksheetSettings.logoDataUrl ?? '';
  const hasExercises = exercises.length > 0;
  const firstExercise = hasExercises ? exercises[0] : null;
  const remainingExercises = hasExercises ? exercises.slice(1) : [];

  const handlePrintWorksheet = () => {
    if (!selectedWorksheet) return;
    const originalTitle = document.title;
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR').replace(/\//g, '-');
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    const safeName = selectedWorksheet.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    document.title = `${safeName}_${dateStr}_${timeStr}`;
    window.print();
    setTimeout(() => { document.title = originalTitle; }, 100);
  };

  const ErrorMessage: React.FC<{ message: string, onClose: () => void }> = ({ message, onClose }) => (
    <div className="container mx-auto my-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg relative" role="alert">
      <strong className="font-bold">Erreur !</strong>
      <span className="block sm:inline ml-2">{message}</span>
      <button onClick={onClose} className="absolute top-0 bottom-0 right-0 px-4 py-3">
        <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
      </button>
    </div>
  );

  const WarningMessage: React.FC<{ message: string, onClose: () => void }> = ({ message, onClose }) => (
    <div className="container mx-auto my-4 p-4 bg-amber-100 border border-amber-400 text-amber-800 rounded-lg relative" role="alert">
      <strong className="font-bold">Attention !</strong>
      <span className="block sm:inline ml-2">{message}</span>
      <button onClick={onClose} className="absolute top-0 bottom-0 right-0 px-4 py-3">
        <svg className="fill-current h-6 w-6 text-amber-600" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
      </button>
    </div>
  );

    return (
      <MathJaxContext
        key={`${mathFont}-${mathScale}`}
        version={4}
        src="https://cdn.jsdelivr.net/npm/mathjax@4/startup.js"
        config={{ ...mathJaxConfig, output: { ...mathJaxConfig.output, font: mathFont, scale: Math.min(140, Math.max(80, mathScale)) / 100 } }}
      >
        <div className={`min-h-screen font-sans ${activeView !== 'dashboard' && selectedWorksheet ? 'bg-[#e8e4dc] print:bg-white' : 'bg-[#f2f0eb]'}`}>
      {importError && (
          <div className="sticky top-0 z-50">
            <ErrorMessage message={importError} onClose={() => setImportError(null)} />
          </div>
      )}
      {storageWarning && (
          <div className="sticky top-0 z-50">
            <WarningMessage message={storageWarning} onClose={() => setStorageWarning(null)} />
          </div>
      )}
      {activeView === 'dashboard' ? (
        <Dashboard
          worksheets={worksheets}
          worksheetClasses={worksheetClasses}
          onSelectWorksheet={handleSelectWorksheet}
          onAddWorksheet={handleAddWorksheet}
          onDeleteWorksheet={handleDeleteWorksheet}
          onRenameWorksheet={handleRenameWorksheet}
          onUpdateWorksheet={handleUpdateWorksheetContent}
          onCreateClass={handleCreateClass}
          onRenameClass={handleRenameClass}
          onDeleteClass={handleDeleteClass}
          onAssignWorksheetClass={handleAssignWorksheetClass}
          onRestoreBackup={handleRestoreBackup}
          setImportError={setImportError}
          onOpenSyncPanel={() => setIsSyncPanelOpen(true)}
          onOpenConfiguration={() => setIsConfigurationOpen(true)}
          cloudSyncStatus={cloudSync.status}
        />
      ) : selectedWorksheet ? (
        <>
          <main
            className="worksheet-typography max-w-4xl landscape:max-w-6xl xl:landscape:max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 transition-all duration-300 print:max-w-none print:p-0 print:py-0"
            style={{
              fontFamily: textFont,
              fontSize: `${Math.min(130, Math.max(80, textScale))}%`,
              '--worksheet-text-font': textFont,
              '--worksheet-handwriting-font': handwritingFont,
              '--worksheet-math-scale': `${Math.min(140, Math.max(80, mathScale))}%`,
              '--worksheet-math-font': 'inherit',
            } as React.CSSProperties}
          >
            <div className="bg-[#f4f1ea] rounded-xl w-full px-6 sm:px-12 md:px-16 pt-10 pb-12 border border-[#e2ddd0] shadow-[0_4px_20px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] print:shadow-none print:bg-transparent print:p-0 print:border-none" style={{ backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.5), rgba(255,255,255,0) 20%), url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noise)" opacity="0.04"/></svg>')` }}>
              <div className="space-y-8 print:space-y-6">
                <div className="title-and-first-exercise-container space-y-6 print:space-y-4">
                <div className="latex-document-header mb-8 mt-0 print:mb-6 print:mt-0 relative">
                  <div className="flex items-start justify-between text-[0.75em] font-semibold uppercase tracking-widest text-[#697478] print:text-black mb-8">
                    <div className="flex flex-col gap-1.5 text-left">
                      {userNameLabel && <span className="text-[#172126] print:text-black">{userNameLabel}</span>}
                      <span>Classe {classNameLabel || '\u2014'}</span>
                    </div>
                    <div className="flex flex-col gap-1.5 text-right">
                      <span>{schoolYearLabel}</span>
                    </div>
                  </div>

                  <div className="mb-10 flex flex-col items-center">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center mb-4">
                        <span className="text-[#19788c] print:text-black text-[0.7em] font-bold uppercase tracking-[0.2em]">
                          Le {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}
                        </span>
                      </div>
                      <div role="heading" aria-level={1} className="font-chapter text-[1.58em] sm:text-[1.85em] md:text-[2.2em] font-medium leading-tight text-[#172126] print:text-[1.8em] tracking-tight">
                        <EditableMathText 
                          text={selectedWorksheet.name} 
                          isEditMode={isEditMode} 
                          onChange={(newTitle) => {
                            handleRenameWorksheet(selectedWorksheet.id, newTitle);
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {firstExercise && (
                  <div className="first-exercise-wrapper">
                    <ExerciseCard
                      key={firstExercise.id || 0}
                      exercise={firstExercise}
                      exerciseNumber={1}
                      totalExercisesCount={exercises.length}
                      showCanvas={showCanvas}
                      answerSpaceMinHeight={answerSpaceMinHeight}
                      answerSpaceStyle={answerSpaceStyle}
                      answerSpaceColor={answerSpaceColor}
                      presentationMode={presentationMode}
                      oneQuestionPerPage={oneQuestionPerPage}
                      onQuestionUpdate={handleQuestionUpdate}
                      onExerciseUpdate={handleExerciseUpdate}
                      onExerciseMergeUp={handleExerciseMergeUp}
                      onQuestionMergeUp={handleQuestionMergeUp}
                      isEditMode={isEditMode}
                    />
                  </div>
                )}
              </div>

              {remainingExercises.length > 0 && remainingExercises.map((exercise, index) => (
                <ExerciseCard
                  key={exercise.id || `exercise-${index + 2}`}
                  exercise={exercise}
                  exerciseNumber={index + 2}
                  totalExercisesCount={exercises.length}
                  showCanvas={showCanvas}
                  answerSpaceMinHeight={answerSpaceMinHeight}
                  answerSpaceStyle={answerSpaceStyle}
                  answerSpaceColor={answerSpaceColor}
                  presentationMode={presentationMode}
                  oneQuestionPerPage={oneQuestionPerPage}
                  onQuestionUpdate={handleQuestionUpdate}
                  onExerciseUpdate={handleExerciseUpdate}
                  onExerciseMergeUp={handleExerciseMergeUp}
                  onQuestionMergeUp={handleQuestionMergeUp}
                  isEditMode={isEditMode}
                />
              ))}

              {!hasExercises && (
                <div className="rounded-[24px] border-2 border-dashed border-[#c9cdc8] bg-[#fffefa] py-20 text-center">
                  <h2 className="text-xl font-semibold text-[#4f5a5d]">Cette fiche ne contient aucun exercice.</h2>
                  <p className="mt-2 text-[#7a8385]">Vous pouvez en ajouter en modifiant le fichier source JSON.</p>
                </div>
              )}

              {logoDataUrl && (
                <div className="flex justify-center pt-6 print:pt-4">
                  <img
                    src={logoDataUrl}
                    alt="Logo de l'établissement"
                    className="max-h-20 object-contain print:max-h-16"
                  />
                </div>
              )}
            </div>
            </div>
          </main>
          {/*
            Barre d'outils UNIQUE de la fiche : montée une seule fois ici, elle
            pilote toutes les zones de réponse (réglages partagés, actions
            adressées à la dernière zone touchée).
          */}
          <CanvasFloatingToolbar
            isEditMode={isEditMode}
            onToggleEditMode={() => setIsEditMode(value => !value)}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            onPrint={handlePrintWorksheet}
          />
          {isSettingsModalOpen && (
            <SettingsModal
              isOpen={isSettingsModalOpen}
              onClose={() => setIsSettingsModalOpen(false)}
              worksheet={selectedWorksheet}
              onSave={(newContent) => {
                handleUpdateWorksheetContent(selectedWorksheet.id, newContent);
                setIsSettingsModalOpen(false);
              }}
            />
          )}
        </>
      ) : (
        <div className="py-16 text-center">
            <h2 className="text-2xl font-semibold text-[#697478]">Fiche non trouvée.</h2>
            <button onClick={handleBackToDashboard} className="mt-6 rounded-full bg-[#172126] px-6 py-2.5 font-medium text-white shadow-sm transition hover:bg-[#25363c] hover:shadow-md">Retour au Dashboard</button>
        </div>
      )}
      <ConfigurationModal
        isOpen={isConfigurationOpen}
        onClose={() => setIsConfigurationOpen(false)}
        configuration={configuration}
        onSave={(nextConfiguration) => {
          setConfiguration(nextConfiguration);
          setIsConfigurationOpen(false);
        }}
      />
      <SyncPanel isOpen={isSyncPanelOpen} onClose={() => setIsSyncPanelOpen(false)} sync={cloudSync} />
        </div>
      </MathJaxContext>
  );
};

export default App;
