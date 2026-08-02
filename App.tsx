import React, { useState, useMemo } from 'react';
import type { Worksheet, WorksheetContent, QuestionPart, Exercise } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import { useCloudSync } from './hooks/useCloudSync';
import Dashboard from './components/Dashboard';
import WorksheetHeader from './components/WorksheetHeader';
import ExerciseCard from './components/ExerciseCard';
import SettingsModal from './components/SettingsModal';
import EditableMathText from './components/EditableMathText';
import SyncPanel from './components/SyncPanel';
import CanvasFloatingToolbar from './components/canvas/FloatingToolbar';

import { initialJson } from "./data/initialWorksheet";
const createDefaultWorksheet = (): Worksheet => ({ id: "ws_default_3", name: initialJson.chapter || "Fiche de Démarrage", createdAt: new Date().toISOString(), content: initialJson }); const computeDefaultSchoolYear = (): string => { const now = new Date(); const year = now.getFullYear(); const month = now.getMonth(); const startYear = month >= 7 ? year : year - 1; return `${startYear}-${startYear + 1}`; };
const App: React.FC = () => {
  const [worksheets, setWorksheets] = useLocalStorage<Worksheet[]>('worksheets', []);
  const cloudSync = useCloudSync(worksheets, setWorksheets);
  const [isSyncPanelOpen, setIsSyncPanelOpen] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'worksheet'>('dashboard');
  const [selectedWorksheetId, setSelectedWorksheetId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);

  React.useEffect(() => {
    setWorksheets(prev => (Array.isArray(prev) && prev.length > 0 ? prev : [createDefaultWorksheet()]));
  }, [setWorksheets]);

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
    setIsHeaderCollapsed(false);
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
    setWorksheets(prev => prev.map(ws =>
      ws.id === id
        ? {
            ...ws,
            name: newName,
            content: {
              ...ws.content,
              chapter: newName
            }
          }
        : ws
    ));
  };

  const handleUpdateWorksheetContent = (worksheetId: string, newContent: WorksheetContent) => {
    setWorksheets(prev => prev.map(ws => 
        ws.id === worksheetId 
        ? { ...ws, content: newContent } 
        : ws
    ));
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
  const defaultSchoolYear = computeDefaultSchoolYear();
  const schoolYearLabel = (worksheetSettings.schoolYear ?? defaultSchoolYear).trim() || defaultSchoolYear;
  const logoDataUrl = worksheetSettings.logoDataUrl ?? '';
  const hasExercises = exercises.length > 0;
  const firstExercise = hasExercises ? exercises[0] : null;
  const remainingExercises = hasExercises ? exercises.slice(1) : [];

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
    <div className="min-h-screen bg-white font-sans">
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
          onSelectWorksheet={handleSelectWorksheet}
          onAddWorksheet={handleAddWorksheet}
          onDeleteWorksheet={handleDeleteWorksheet}
          onRenameWorksheet={handleRenameWorksheet}
          onUpdateWorksheet={handleUpdateWorksheetContent}
          onRestoreBackup={handleRestoreBackup}
          setImportError={setImportError}
          onOpenSyncPanel={() => setIsSyncPanelOpen(true)}
          cloudSyncStatus={cloudSync.status}
        />
      ) : selectedWorksheet ? (
        <>
          <WorksheetHeader 
            worksheetName={selectedWorksheet.name}
            isCollapsed={isHeaderCollapsed}
            onToggleCollapse={setIsHeaderCollapsed}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            isEditMode={isEditMode}
            onToggleEditMode={() => setIsEditMode(!isEditMode)}
          />
          <main className={`max-w-4xl landscape:max-w-6xl xl:landscape:max-w-7xl mx-auto px-4 landscape:px-2 sm:landscape:px-4 py-8 landscape:py-4 ${isHeaderCollapsed ? 'mt-10 sm:mt-12' : 'mt-16 sm:mt-20'} transition-all duration-300 print:mt-0 print:max-w-none print:p-0 print:py-0`}>
            <div className="space-y-8 print:space-y-6">
              <div className="title-and-first-exercise-container space-y-6 print:space-y-4">
                <div className="flex flex-wrap items-start justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 print:text-[9pt] print:text-black">
                  <span className="text-left break-words">
                    Classe : {classNameLabel || '\u2014'}
                  </span>
                  <span className="text-right break-words">
                    {schoolYearLabel}
                  </span>
                </div>

                {selectedWorksheet.content.chapter && (
                  <div className="text-center py-2 print:py-0">
                    <div role="heading" aria-level={1} className="text-4xl md:text-5xl font-bold font-display text-slate-900 print:text-3xl print:mb-0 tracking-tight">
                      <EditableMathText 
                        text={selectedWorksheet.content.chapter} 
                        isEditMode={isEditMode} 
                        onChange={(newTitle) => {
                          handleUpdateWorksheetContent(selectedWorksheet.id, {
                            ...selectedWorksheet.content,
                            chapter: newTitle
                          });
                        }} 
                      />
                    </div>
                  </div>
                )}

                {firstExercise && (
                  <div className="first-exercise-wrapper">
                    <ExerciseCard
                      key={firstExercise.id || 0}
                      exercise={firstExercise}
                      exerciseNumber={1}
                      showCanvas={showCanvas}
                      answerSpaceMinHeight={answerSpaceMinHeight}
                      answerSpaceStyle={answerSpaceStyle}
                      answerSpaceColor={answerSpaceColor}
                      presentationMode={presentationMode}
                      oneQuestionPerPage={oneQuestionPerPage}
                      onQuestionUpdate={handleQuestionUpdate}
                      onExerciseUpdate={handleExerciseUpdate}
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
                  showCanvas={showCanvas}
                  answerSpaceMinHeight={answerSpaceMinHeight}
                  answerSpaceStyle={answerSpaceStyle}
                  answerSpaceColor={answerSpaceColor}
                  presentationMode={presentationMode}
                  oneQuestionPerPage={oneQuestionPerPage}
                  onQuestionUpdate={handleQuestionUpdate}
                  onExerciseUpdate={handleExerciseUpdate}
                  isEditMode={isEditMode}
                />
              ))}

              {!hasExercises && (
                <div className="text-center py-20 border-2 border-dashed border-slate-300 bg-slate-50">
                  <h2 className="text-xl font-semibold text-slate-600">Cette fiche ne contient aucun exercice.</h2>
                  <p className="text-slate-500 mt-2">Vous pouvez en ajouter en modifiant le fichier source JSON.</p>
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
          </main>
          {/*
            Barre d'outils UNIQUE de la fiche : montée une seule fois ici, elle
            pilote toutes les zones de réponse (réglages partagés, actions
            adressées à la dernière zone touchée).
          */}
          {showCanvas && <CanvasFloatingToolbar />}
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
        <div className="text-center py-16">
            <h2 className="text-2xl font-semibold text-slate-500">Fiche non trouvée.</h2>
            <button onClick={handleBackToDashboard} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl transition shadow-sm hover:shadow-md font-medium">Retour au Dashboard</button>
        </div>
      )}
      <SyncPanel isOpen={isSyncPanelOpen} onClose={() => setIsSyncPanelOpen(false)} sync={cloudSync} />
    </div>
  );
};

export default App;
