import React, { useState, useMemo } from 'react';
import type { Worksheet, WorksheetContent, QuestionPart, Exercise } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import Dashboard from './components/Dashboard';
import WorksheetHeader from './components/WorksheetHeader';
import ExerciseCard from './components/ExerciseCard';
import SettingsModal from './components/SettingsModal';

const initialJson: WorksheetContent = {
  "chapter": "Logique et Raisonnements",
  "exercises": [
    {
      "id": "ex1",
      "title": "Techniques de démonstration",
      "statement": "",
      "questions": [
        {
          "text": "Donner la négation des assertions suivantes :",
          "subquestions": [
            {
              "text": "$(P): \\forall x \\in \\mathbb{R}, \\exists k \\in \\mathbb{Z} ; k \\le x < k+1$"
            },
            {
              "text": "$(Q): \\forall (\\alpha, \\beta) \\in \\mathbb{R}^2 ; (\\alpha - \\beta) > 1 \\implies \\exists n \\in \\mathbb{Z} ; \\alpha < n < \\beta$"
            }
          ]
        },
        {
          "text": "Montrer par la contraposée que : $\\forall n \\in \\mathbb{N}; \\frac{n^2}{3} \\in \\mathbb{N} \\implies \\frac{n}{3} \\in \\mathbb{N}$"
        },
        {
          "text": "En déduire par l'absurde que : $\\sqrt{3} \\notin \\mathbb{Q}$"
        },
        {
          "text": "Soit $q \\in \\mathbb{R} \\setminus \\{1\\}$. Montrer par récurrence que : $\\forall n \\in \\mathbb{N}^*; q + q^2 + \\dots + q^n = q \\times \\frac{q^n - 1}{q - 1}$"
        }
      ]
    },
    {
      "id": "ex2",
      "title": "Raisonnements et assertions logiques",
      "statement": "",
      "questions": [
        {
          "text": "Montrer que : $\\forall n \\in \\mathbb{N}; 7 \\mid 21^n - 2^{3n}$"
        },
        {
          "text": "Montrer que : $\\forall x \\in \\mathbb{R}_+^*; x \\ne 0 \\implies \\sqrt{x+1} \\le 1 + \\frac{x}{2}$"
        },
        {
          "text": "On considère les deux assertions : $P: \\forall x \\in \\mathbb{R}_+^*; x \\ge 2\\sqrt{x} - 1$ et $Q: \\forall y \\in \\mathbb{R}, \\exists x \\in \\mathbb{R}; xy \\ne x$",
          "subquestions": [
            {
              "text": "Donner la négation de $P$ et de $Q$"
            },
            {
              "text": "Montrer que $P$ est vraie et que $Q$ est fausse"
            },
            {
              "text": "Déterminer la valeur de vérité de : $R: (\\exists y \\in \\mathbb{R}, \\forall x \\in \\mathbb{R}; xy = x) \\implies (\\exists x \\in \\mathbb{R}_+^*; x < 2\\sqrt{x} - 1)$"
            }
          ]
        }
      ]
    },
    {
      "id": "ex3",
      "title": "Arithmétique et polynômes",
      "statement": "",
      "questions": [
        {
          "text": "Démontrer que l'équation $9x^5 - 12x^4 + 6x - 5 = 0$ n'admet pas de solution entière."
        }
      ]
    },
    {
      "id": "ex4",
      "title": "Nombres irrationnels",
      "statement": "On rappelle que $\\sqrt{2}$ est un nombre irrationnel.",
      "questions": [
        {
          "text": "Démontrer que si $a$ et $b$ sont deux entiers relatifs tels que $a + b\\sqrt{2} = 0$, alors $a = b = 0$."
        },
        {
          "text": "En déduire que si $m, n, p$ et $q$ sont des entiers relatifs, alors $m + n\\sqrt{2} = p + q\\sqrt{2} \\iff (m = p \\text{ et } n = q)$."
        }
      ]
    }
  ]
};

const createDefaultWorksheet = (): Worksheet => ({
  id: 'ws_default_1',
  name: initialJson.chapter || 'Fiche de Démarrage',
  createdAt: new Date().toISOString(),
  content: initialJson
});

const computeDefaultSchoolYear = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};

const App: React.FC = () => {
  const [worksheets, setWorksheets] = useLocalStorage<Worksheet[]>('worksheets', []);
  const [activeView, setActiveView] = useState<'dashboard' | 'worksheet'>('dashboard');
  const [selectedWorksheetId, setSelectedWorksheetId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);

  React.useEffect(() => {
    const storedWorksheets = window.localStorage.getItem('worksheets');
    if (!storedWorksheets || JSON.parse(storedWorksheets).length === 0) {
      setWorksheets([createDefaultWorksheet()]);
    }
  }, [setWorksheets]);

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
  
  const handleQuestionUpdate = (exerciseId: string, questionPath: (string | number)[], newProps: Partial<QuestionPart>) => {
    if (!selectedWorksheet) return;

    const newContent = JSON.parse(JSON.stringify(selectedWorksheet.content));
    
    const exercise = newContent.exercises.find((ex: Exercise) => ex.id === exerciseId);
    if (!exercise) return;

    let target: any = exercise;
    try {
      for (const key of questionPath) {
          target = target[key];
      }
      Object.assign(target, newProps);
      handleUpdateWorksheetContent(selectedWorksheet.id, newContent);
    } catch (error) {
       console.error("Could not update question. Invalid path:", questionPath, error);
    }
  };

  const handleExerciseUpdate = (exerciseId: string, newProps: Partial<Exercise>) => {
    if (!selectedWorksheet) return;

    const newContent = JSON.parse(JSON.stringify(selectedWorksheet.content));
    const exerciseIndex = newContent.exercises.findIndex((ex: Exercise) => ex.id === exerciseId);

    if (exerciseIndex > -1) {
      Object.assign(newContent.exercises[exerciseIndex], newProps);
      handleUpdateWorksheetContent(selectedWorksheet.id, newContent);
    } else {
      console.error("Could not find exercise to update:", exerciseId);
    }
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

  return (
    <div className="min-h-screen bg-white font-sans">
      {importError && (
          <div className="sticky top-0 z-50">
            <ErrorMessage message={importError} onClose={() => setImportError(null)} />
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
        />
      ) : selectedWorksheet ? (
        <>
          <WorksheetHeader 
            worksheetName={selectedWorksheet.name}
            isCollapsed={isHeaderCollapsed}
            onToggleCollapse={setIsHeaderCollapsed}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
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
                    <h1 className="text-4xl md:text-5xl font-bold font-display text-slate-900 print:text-3xl print:mb-0 tracking-tight">
                      {selectedWorksheet.content.chapter}
                    </h1>
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
    
    </div>
  );
};

export default App;
