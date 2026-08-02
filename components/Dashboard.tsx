import React, { useState, useMemo } from 'react';
import type { Worksheet, WorksheetContent } from '../types';
import { Trash2, Pencil, Search, Code, Calendar, ChevronRight, FileText, Plus, Menu, Cloud, Download, X } from 'lucide-react';
import JSONManagerModal from './JSONManagerModal';
import type { CloudSyncStatus } from '../hooks/useCloudSync';
import { usePwaInstall } from '../hooks/usePwaInstall';

interface DashboardProps {
    worksheets: Worksheet[];
    onSelectWorksheet: (id: string) => void;
    onAddWorksheet: (worksheet: Worksheet) => void;
    onDeleteWorksheet: (id: string) => void;
    onRenameWorksheet: (id: string, newName: string) => void;
    onUpdateWorksheet: (id: string, content: WorksheetContent) => void;
    onRestoreBackup: (backupWorksheets: Worksheet[]) => void;
    setImportError: (error: string | null) => void;
    onOpenSyncPanel: () => void;
    cloudSyncStatus: CloudSyncStatus;
}

const Dashboard: React.FC<DashboardProps> = ({
    worksheets,
    onSelectWorksheet,
    onAddWorksheet,
    onDeleteWorksheet,
    onRenameWorksheet,
    onUpdateWorksheet,
    onRestoreBackup,
    setImportError,
    onOpenSyncPanel,
    cloudSyncStatus
}) => {
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [visibleCount, setVisibleCount] = useState(6);
    
    const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
    const [jsonMode, setJsonMode] = useState<'create' | 'edit'>('create');
    const [editingWorksheet, setEditingWorksheet] = useState<Worksheet | null>(null);
    const [showInstallHelp, setShowInstallHelp] = useState(false);
    const { installed, nativePromptAvailable, requestInstall } = usePwaInstall();

    const handleInstall = async () => {
        if (nativePromptAvailable && await requestInstall()) return;
        setShowInstallHelp(true);
    };

    const processImport = (jsonData: WorksheetContent, fallbackName: string = 'Nouvelle Fiche') => {
        if (!jsonData.chapter || typeof jsonData.chapter !== 'string' || !jsonData.exercises || !Array.isArray(jsonData.exercises)) {
            throw new Error('Le JSON est invalide. Il doit contenir une cle "chapter" (texte) et une cle "exercises" (tableau).');
        }
        
        const newWorksheet: Worksheet = {
            id: `ws_${Date.now()}`,
            name: jsonData.chapter || fallbackName.replace('.json', '') || 'Nouvelle Fiche',
            createdAt: new Date().toISOString(),
            content: jsonData,
        };
        onAddWorksheet(newWorksheet);
    };

    const handleRename = (worksheet: Worksheet) => {
        setRenamingId(worksheet.id);
        setNewName(worksheet.name);
    }

    const handleSaveRename = (e: React.FormEvent) => {
        e.preventDefault();
        if (renamingId && newName.trim()) {
            onRenameWorksheet(renamingId, newName.trim());
            setRenamingId(null);
            setNewName('');
        }
    }

    const handleOpenManager = () => {
        setJsonMode('create');
        setEditingWorksheet(null);
        setIsManagerModalOpen(true);
    };

    const handleEditJson = (worksheet: Worksheet) => {
        setJsonMode('edit');
        setEditingWorksheet(worksheet);
        setIsManagerModalOpen(true);
    };

    const handleJsonSave = (content: WorksheetContent) => {
        try {
            if (jsonMode === 'create') {
                processImport(content);
            } else if (jsonMode === 'edit' && editingWorksheet) {
                onUpdateWorksheet(editingWorksheet.id, content);
                if (content.chapter && content.chapter !== editingWorksheet.name) {
                    onRenameWorksheet(editingWorksheet.id, content.chapter);
                }
            }
        } catch (error) {
            setImportError(error instanceof Error ? error.message : 'JSON invalide.');
        }
    };

    const filteredWorksheets = useMemo(() => {
        if (!searchQuery) {
            return worksheets;
        }
        return worksheets.filter(ws => 
            ws.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [worksheets, searchQuery]);

    const sortedWorksheets = useMemo(() => {
        return [...filteredWorksheets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [filteredWorksheets]);

    const visibleWorksheets = sortedWorksheets.slice(0, visibleCount);

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-6xl mx-auto px-6 py-12 md:px-10">

            {/* ── Header ── */}
            <header className="mb-12 border-b border-slate-200 pb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-semibold font-display text-slate-900 tracking-tight">Mes Fiches d'Exercices</h1>
                        <p className="text-slate-500 mt-2 text-base">{worksheets.length} fiche{worksheets.length !== 1 ? 's' : ''} disponible{worksheets.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-grow sm:flex-grow-0">
                            <Search className="h-5 w-5 text-slate-400 absolute top-1/2 left-3.5 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full sm:w-64 pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-base focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition placeholder:text-slate-400 outline-none shadow-sm"
                                aria-label="Rechercher une fiche par nom"
                            />
                        </div>

                        {!installed && (
                            <button
                                onClick={handleInstall}
                                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 text-sky-700 shadow-sm transition-all hover:border-sky-300 hover:bg-sky-100 hover:shadow-md active:scale-95 shrink-0 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                                title="Installer l'application"
                                aria-label="Installer l'application"
                            >
                                <Download className="h-5 w-5" />
                                <span className="hidden lg:inline text-sm font-bold">Installer</span>
                            </button>
                        )}
                        
                        <button
                            onClick={onOpenSyncPanel}
                            className="relative flex justify-center items-center p-2.5 bg-white text-slate-600 border border-slate-300 hover:text-sky-600 hover:border-sky-600 hover:bg-sky-50 rounded-xl transition-all shadow-sm hover:shadow-md shrink-0 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
                            title="Synchronisation PC / Tablette"
                            aria-label="Synchronisation PC / Tablette"
                        >
                            <Cloud className="h-5 w-5" />
                            {cloudSyncStatus !== 'disconnected' && (
                                <span
                                    className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                                        cloudSyncStatus === 'error' ? 'bg-red-500' : cloudSyncStatus === 'syncing' ? 'bg-amber-400' : 'bg-emerald-500'
                                    }`}
                                />
                            )}
                        </button>

                        <button
                            onClick={handleOpenManager}
                            className="flex justify-center items-center p-2.5 bg-white text-slate-600 border border-slate-300 hover:text-blue-600 hover:border-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm hover:shadow-md shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                            title="Gestionnaire JSON"
                            aria-label="Gestionnaire JSON"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </header>
            
            {/* ── Cards grid ── */}
            {sortedWorksheets.length > 0 ? (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* "New" card */}
                    <div 
                        onClick={handleOpenManager}
                        className="group rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 flex items-center justify-center cursor-pointer transition-all duration-300 min-h-[200px] bg-slate-50/50 hover:bg-blue-50/50 hover:-translate-y-1"
                    >
                        <div className="flex flex-col items-center gap-3 text-slate-500 group-hover:text-blue-600 transition-colors">
                            <Plus className="h-8 w-8 group-hover:scale-110 transition-transform duration-300" />
                            <span className="text-base font-medium">Créer une nouvelle fiche</span>
                        </div>
                    </div>

                    {visibleWorksheets.map((ws) => {
                        const classNameLabel = ws.content?.settings?.className?.trim() || '';
                        const exerciseCount = ws.content?.exercises?.length || 0;

                        return (
                            <div 
                                key={ws.id} 
                                className="group bg-white rounded-2xl border border-slate-200 hover:border-blue-400 flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer min-h-[200px] overflow-hidden"
                                onClick={() => onSelectWorksheet(ws.id)}
                                onDoubleClick={(e) => { e.stopPropagation(); handleEditJson(ws); }}
                                title="Cliquez pour ouvrir"
                            >
                               <div className="p-6 flex-1 flex flex-col">
                                   {/* Title + actions row */}
                                   <div className="flex items-start justify-between gap-3 mb-4">
                                       {renamingId === ws.id ? (
                                           <form onSubmit={handleSaveRename} onClick={(e) => e.stopPropagation()} className="flex-1">
                                               <input 
                                                   type="text"
                                                   value={newName}
                                                   onChange={(e) => setNewName(e.target.value)}
                                                   onBlur={handleSaveRename}
                                                   autoFocus
                                                   className="text-lg font-semibold font-display text-slate-900 w-full border-b-2 border-blue-600 focus:outline-none bg-transparent pb-1"
                                               />
                                           </form>
                                       ) : (
                                           <h2 className="text-lg font-semibold font-display text-slate-900 leading-snug line-clamp-2 flex-1 group-hover:text-blue-700 transition-colors">
                                               {ws.name}
                                           </h2>
                                       )}

                                       {/* Hover actions */}
                                       <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-white/90 backdrop-blur-sm p-1 rounded-xl border border-slate-100 shadow-sm" onClick={(e) => e.stopPropagation()}>
                                           <button 
                                               onClick={() => handleRename(ws)} 
                                               className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" 
                                               aria-label="Renommer"
                                           >
                                               <Pencil className="h-5 w-5" />
                                           </button>
                                           <button 
                                               onClick={() => handleEditJson(ws)} 
                                               className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" 
                                               aria-label="Editer JSON"
                                           >
                                               <Code className="h-5 w-5" />
                                           </button>
                                           <button 
                                               onClick={() => onDeleteWorksheet(ws.id)} 
                                               className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" 
                                               aria-label="Supprimer"
                                           >
                                               <Trash2 className="h-5 w-5" />
                                           </button>
                                       </div>
                                   </div>

                                   {/* Meta info */}
                                   <div className="mt-auto px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-base text-slate-600 -mx-6 -mb-6">
                                       <div className="flex items-center gap-5">
                                           <span className="flex items-center gap-2 font-medium">
                                               <FileText className="h-5 w-5 text-slate-400" />
                                               {exerciseCount} ex.
                                           </span>
                                           {classNameLabel && (
                                               <span className="truncate max-w-[150px] bg-white px-3 py-1 text-sm font-semibold text-slate-700 border border-slate-200 rounded-lg shadow-sm">{classNameLabel}</span>
                                           )}
                                       </div>
                                       <div className="flex items-center gap-3">
                                           <span className="flex items-center gap-2">
                                               <Calendar className="h-5 w-5 text-slate-400" />
                                               {new Date(ws.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                           </span>
                                           <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-600 transition-colors" />
                                       </div>
                                   </div>
                               </div>
                            </div>
                        );
                    })}
                </div>
                
                {visibleCount < sortedWorksheets.length && (
                    <div className="mt-10 text-center">
                        <button
                            onClick={() => setVisibleCount(prev => prev + 6)}
                            className="bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 font-medium py-2.5 px-8 rounded-full transition-all shadow-sm hover:shadow-md"
                        >
                            Voir plus
                        </button>
                    </div>
                )}
                </>
            ) : (
                <div className="text-center py-24 border-2 border-dashed border-slate-300 rounded-3xl bg-white">
                    {searchQuery ? (
                        <>
                            <Search className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-slate-600">Aucun résultat</h2>
                            <p className="text-slate-500 mt-2 text-base">Essayez avec d'autres mots-clés.</p>
                        </>
                    ) : (
                        <>
                            <FileText className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-slate-600">Aucune fiche</h2>
                            <p className="text-slate-500 mt-2 text-base mb-6">Importez un fichier JSON ou créez une nouvelle fiche pour commencer.</p>
                            <button
                                onClick={handleOpenManager}
                                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-xl transition-all shadow-sm hover:shadow-md"
                            >
                                <Plus className="h-5 w-5" />
                                Créer une fiche
                            </button>
                        </>
                    )}
                </div>
            )}

            <JSONManagerModal 
                isOpen={isManagerModalOpen}
                onClose={() => setIsManagerModalOpen(false)}
                worksheets={worksheets}
                onRestoreBackup={onRestoreBackup}
                onSaveWorksheet={handleJsonSave}
                initialValue={jsonMode === 'edit' && editingWorksheet ? editingWorksheet.content : undefined}
                mode={jsonMode}
            />

            {showInstallHelp && (
                <aside
                    role="dialog"
                    aria-label="Installer l'application"
                    className="fixed bottom-4 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.22)] backdrop-blur-xl"
                >
                    <button
                        type="button"
                        onClick={() => setShowInstallHelp(false)}
                        className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Fermer les instructions d'installation"
                    >
                        <X className="h-5 w-5" />
                    </button>
                    <div className="flex gap-3 pr-8">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700">
                            <Download className="h-5 w-5" />
                        </span>
                        <div>
                            <h2 className="font-display text-base font-bold text-slate-900">Installer MathPlus</h2>
                            <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">
                                Ouvrez le menu du navigateur puis choisissez <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong>. Sur iPhone/iPad, utilisez <strong>Partager</strong>, puis <strong>Sur l’écran d’accueil</strong>.
                            </p>
                        </div>
                    </div>
                </aside>
            )}
            </div>
        </div>
    );
};

export default Dashboard;
