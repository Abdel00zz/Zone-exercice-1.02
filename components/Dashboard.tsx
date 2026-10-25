import React, { useState, useMemo, useRef, useEffect, useDeferredValue } from 'react';
import type { PaperTheme, Worksheet, WorksheetContent } from '../types';
import { Search, Folder, FileText, Plus, PanelLeftClose, PanelLeftOpen, Sparkles, X } from 'lucide-react';
import WorksheetCard from './WorksheetCard';
import DashboardSidebar from './DashboardSidebar';
import type { CloudSyncStatus } from '../hooks/useCloudSync';
import { 
    getWorksheetClassName, 
    getWorksheetChapterName, 
    buildWorksheetTree, 
    generateDynamicSubtitle,
    normalizeWorksheetJson,
    type TreeFilter 
} from '../utils/worksheetUtils';
import {
    buildWorksheetSearchDocument,
    searchWorksheet,
    type WorksheetSearchMatch,
    type WorksheetSearchNavigation,
} from '../utils/worksheetSearch';

const JSONManagerModal = React.lazy(() => import('./JSONManagerModal'));
const WorksheetInfoModal = React.lazy(() => import('./WorksheetInfoModal'));
const HelpModal = React.lazy(() => import('./HelpModal'));
import { useOnlineStatus } from '../hooks/usePwaInstall';

interface DashboardProps {
    worksheets: Worksheet[];
    worksheetClasses: string[];
    onSelectWorksheet: (id: string, navigation?: WorksheetSearchNavigation) => void;
    onAddWorksheet: (worksheet: Worksheet) => void;
    onDeleteWorksheet: (id: string) => void;
    onRenameWorksheet: (id: string, newName: string) => void;
    onUpdateWorksheet: (id: string, content: WorksheetContent) => void;
    onCreateClass: (name: string) => void;
    onRenameClass: (previousName: string, nextName: string) => void;
    onDeleteClass: (className: string) => void;
    onAssignWorksheetClass: (worksheetId: string, className: string) => void;
    onRestoreBackup: (backupWorksheets: Worksheet[]) => void;
    setImportError: (error: string | null) => void;
    onOpenSyncPanel: () => void;
    onOpenConfiguration: () => void;
    cloudSyncStatus: CloudSyncStatus;
    defaultPaperTheme: PaperTheme;
}

const Dashboard: React.FC<DashboardProps> = ({
    worksheets,
    worksheetClasses,
    onSelectWorksheet,
    onAddWorksheet,
    onDeleteWorksheet,
    onRenameWorksheet,
    onUpdateWorksheet,
    onCreateClass,
    onRenameClass,
    onDeleteClass,
    onAssignWorksheetClass,
    onRestoreBackup,
    setImportError,
    onOpenSyncPanel,
    onOpenConfiguration,
    cloudSyncStatus,
    defaultPaperTheme,
}) => {
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [visibleCount, setVisibleCount] = useState(6);
    
    const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
    const [infoModalWorksheet, setInfoModalWorksheet] = useState<Worksheet | null>(null);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const isOnline = useOnlineStatus();
    const [jsonMode, setJsonMode] = useState<'create' | 'edit'>('create');
    const [editingWorksheet, setEditingWorksheet] = useState<Worksheet | null>(null);
    const [collapsedClasses, setCollapsedClasses] = useState<Record<string, boolean>>({});
    const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
    const [treeRename, setTreeRename] = useState<{ type: 'class' | 'chapter' | 'worksheet'; className?: string; chapterName?: string; worksheetId?: string } | null>(null);
    const [treeRenameValue, setTreeRenameValue] = useState('');
    const [movingWorksheetId, setMovingWorksheetId] = useState<string | null>(null);
    const [isCreatingClass, setIsCreatingClass] = useState(false);
    const [newClassName, setNewClassName] = useState('');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [treeFilter, setTreeFilter] = useState<TreeFilter>(null);

    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const deferredSearchQuery = useDeferredValue(searchQuery);

    useEffect(() => {
        const handleSearchShortcut = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase('fr') === 'k') {
                event.preventDefault();
                setIsSearchExpanded(true);
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleSearchShortcut);
        return () => window.removeEventListener('keydown', handleSearchShortcut);
    }, []);

    const processImport = (jsonData: any, fallbackName: string = 'Nouvelle Fiche') => {
        const normalized = normalizeWorksheetJson(jsonData);
        
        const newWorksheet: Worksheet = {
            id: `ws_${Date.now()}`,
            name: normalized.chapter || fallbackName.replace('.json', '') || 'Nouvelle Fiche',
            createdAt: new Date().toISOString(),
            content: normalized,
        };
        onAddWorksheet(newWorksheet);
    };

    const handleSaveRename = (e: React.FormEvent) => {
        e.preventDefault();
        if (renamingId && newName.trim()) {
            onRenameWorksheet(renamingId, newName.trim());
            setRenamingId(null);
            setNewName('');
        }
    };

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

    const searchDocuments = useMemo(
        () => worksheets.map(buildWorksheetSearchDocument),
        [worksheets],
    );

    const searchMatches = useMemo(() => {
        const matches = new Map<string, WorksheetSearchMatch>();
        if (!deferredSearchQuery.trim()) return matches;
        searchDocuments.forEach(document => {
            const match = searchWorksheet(document, deferredSearchQuery);
            if (match) matches.set(document.worksheet.id, match);
        });
        return matches;
    }, [deferredSearchQuery, searchDocuments]);

    const filteredWorksheets = useMemo(() => {
        const hasSearch = Boolean(deferredSearchQuery.trim());

        return worksheets.filter((worksheet) => {
            const className = getWorksheetClassName(worksheet);
            const chapterName = getWorksheetChapterName(worksheet);
            const isInSelectedBranch = !treeFilter
                || (treeFilter.type === 'class' && className === treeFilter.className)
                || (treeFilter.type === 'chapter' && className === treeFilter.className && chapterName === treeFilter.chapterName)
                || (treeFilter.type === 'worksheet' && worksheet.id === treeFilter.worksheetId);

            return isInSelectedBranch && (!hasSearch || searchMatches.has(worksheet.id));
        });
    }, [worksheets, deferredSearchQuery, searchMatches, treeFilter]);

    const sortedWorksheets = useMemo(() => {
        return [...filteredWorksheets].sort((a, b) => {
            if (deferredSearchQuery.trim()) {
                const relevance = (searchMatches.get(b.id)?.score || 0) - (searchMatches.get(a.id)?.score || 0);
                if (relevance !== 0) return relevance;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [deferredSearchQuery, filteredWorksheets, searchMatches]);

    const dynamicSubtitle = useMemo(() => {
        return generateDynamicSubtitle(deferredSearchQuery, treeFilter, sortedWorksheets.length, worksheets);
    }, [deferredSearchQuery, treeFilter, sortedWorksheets.length, worksheets]);

    const visibleWorksheets = sortedWorksheets.slice(0, visibleCount);

    const selectTreeClass = (className: string) => {
        setTreeFilter((current) => current?.type === 'class' && current.className === className ? null : { type: 'class', className });
        setSearchQuery('');
        setVisibleCount(6);
    };

    const selectTreeChapter = (className: string, chapterName: string) => {
        setTreeFilter((current) => current?.type === 'chapter' && current.className === className && current.chapterName === chapterName ? null : { type: 'chapter', className, chapterName });
        setSearchQuery('');
        setVisibleCount(6);
    };

    const selectTreeWorksheet = (worksheetId: string) => {
        setTreeFilter((current) => current?.type === 'worksheet' && current.worksheetId === worksheetId ? null : { type: 'worksheet', worksheetId });
        setSearchQuery('');
        setVisibleCount(6);
    };

    const worksheetTree = useMemo(() => {
        return buildWorksheetTree(worksheets, worksheetClasses);
    }, [worksheetClasses, worksheets]);

    const startTreeRename = (target: NonNullable<typeof treeRename>, value: string) => {
        setTreeRename(target);
        setTreeRenameValue(value);
    };

    const cancelTreeRename = () => {
        setTreeRename(null);
        setTreeRenameValue('');
    };

    const saveTreeRename = () => {
        const value = treeRenameValue.trim();
        if (!treeRename || !value) return cancelTreeRename();

        if (treeRename.type === 'class' && treeRename.className) {
            onRenameClass(treeRename.className, value);
            setTreeFilter((current) => current?.type === 'class' && current.className === treeRename.className
                ? { type: 'class', className: value }
                : current);
        } else if (treeRename.type === 'chapter' && treeRename.className !== undefined && treeRename.chapterName !== undefined) {
            const { className: targetClassName, chapterName: oldChapterName } = treeRename;
            worksheets.forEach((worksheet) => {
                if (getWorksheetClassName(worksheet) === targetClassName && getWorksheetChapterName(worksheet) === oldChapterName) {
                    onUpdateWorksheet(worksheet.id, { ...worksheet.content, chapter: value });
                }
            });
            setTreeFilter((current) => current?.type === 'chapter' && current.className === targetClassName && current.chapterName === oldChapterName
                ? { type: 'chapter', className: targetClassName, chapterName: value }
                : current);
        } else if (treeRename.type === 'worksheet' && treeRename.worksheetId) {
            onRenameWorksheet(treeRename.worksheetId, value);
        }
        cancelTreeRename();
    };

    const handleCreateClass = (event: React.FormEvent) => {
        event.preventDefault();
        const value = newClassName.trim();
        if (!value) return;
        onCreateClass(value);
        setNewClassName('');
        setIsCreatingClass(false);
        setCollapsedClasses((current) => ({ ...current, [value]: false }));
    };

    const handleDeleteClass = (className: string) => {
        if (window.confirm(`Supprimer la classe « ${className} » ? Ses chapitres seront déplacés dans Non classé.`)) {
            setTreeFilter((current) => current?.type === 'class' && current.className === className ? null : current);
            onDeleteClass(className);
        }
    };

    const handleDeleteWorksheet = (worksheetId: string) => {
        setTreeFilter((current) => current?.type === 'worksheet' && current.worksheetId === worksheetId ? null : current);
        onDeleteWorksheet(worksheetId);
    };

    return (
        <div className="min-h-screen bg-dash-bg text-dash-main">
            <div className={`relative mx-auto grid min-h-screen w-full max-w-[1680px] content-start transition-[grid-template-columns] duration-300 lg:content-normal ${sidebarCollapsed ? 'lg:grid-cols-[0px_minmax(0,1fr)]' : 'lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]'}`}>
                {/* ── Navigation / outils & Arborescence des classes ── */}
                <DashboardSidebar 
                    sidebarCollapsed={sidebarCollapsed}
                    setSidebarCollapsed={setSidebarCollapsed}
                    cloudSyncStatus={cloudSyncStatus}
                    onOpenSyncPanel={onOpenSyncPanel}
                    onOpenConfiguration={onOpenConfiguration}
                    onOpenHelp={() => setIsHelpModalOpen(true)}
                    worksheetTree={worksheetTree}
                    isCreatingClass={isCreatingClass}
                    setIsCreatingClass={setIsCreatingClass}
                    newClassName={newClassName}
                    setNewClassName={setNewClassName}
                    handleCreateClass={handleCreateClass}
                    collapsedClasses={collapsedClasses}
                    setCollapsedClasses={setCollapsedClasses}
                    expandedChapters={expandedChapters}
                    setExpandedChapters={setExpandedChapters}
                    treeFilter={treeFilter}
                    treeRename={treeRename}
                    treeRenameValue={treeRenameValue}
                    setTreeRenameValue={setTreeRenameValue}
                    saveTreeRename={saveTreeRename}
                    cancelTreeRename={cancelTreeRename}
                    startTreeRename={startTreeRename}
                    selectTreeClass={selectTreeClass}
                    selectTreeChapter={selectTreeChapter}
                    selectTreeWorksheet={selectTreeWorksheet}
                    handleDeleteClass={handleDeleteClass}
                    handleDeleteWorksheet={handleDeleteWorksheet}
                    movingWorksheetId={movingWorksheetId}
                    setMovingWorksheetId={setMovingWorksheetId}
                    worksheetClasses={worksheetClasses}
                    onAssignWorksheetClass={onAssignWorksheetClass}
                    onSelectWorksheet={onSelectWorksheet}
                />

                {/* ── Bibliothèque de fiches ── */}
                <main className="min-w-0 px-3.5 pt-3.5 pb-7 sm:px-5 sm:pt-3.5 sm:pb-8 lg:pl-3 lg:pr-6 xl:pl-4 xl:pr-8 2xl:pl-4 2xl:pr-8">
                    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3 min-w-0">
                            <button
                                type="button"
                                onClick={() => setSidebarCollapsed((current) => !current)}
                                className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-dash-teal-light text-dash-teal transition hover:bg-dash-teal-hover focus:outline-none"
                                title={sidebarCollapsed ? 'Développer la barre latérale' : 'Réduire la barre latérale'}
                                aria-label={sidebarCollapsed ? 'Développer la barre latérale' : 'Réduire la barre latérale'}
                            >
                                {sidebarCollapsed ? <PanelLeftOpen className="h-4.5 w-4.5" /> : <PanelLeftClose className="h-4.5 w-4.5" />}
                            </button>
                            <div className="block min-w-0">
                                <h2 className="font-serif text-lg font-semibold leading-snug tracking-[-0.02em] text-dash-main sm:text-xl md:text-2xl">
                                    Mes Fiches d'Exercices
                                </h2>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <p className="text-xs font-semibold leading-normal text-dash-muted">
                                        {dynamicSubtitle}
                                    </p>
                                    {(treeFilter || searchQuery) && (
                                        <button 
                                            type="button" 
                                            onClick={() => { setTreeFilter(null); setSearchQuery(''); setVisibleCount(6); }} 
                                            className="rounded-full bg-dash-teal-light px-2.5 py-0.5 text-[11px] font-bold text-dash-teal transition hover:bg-dash-teal-hover" 
                                            title="Réinitialiser le filtre"
                                        >
                                            Tout afficher
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center sm:min-h-[42px] justify-end">
                            <div 
                                className={`relative z-30 flex items-center transition-[width] duration-300 ease-out ${isSearchExpanded || searchQuery ? 'w-full sm:w-[330px] lg:w-[390px]' : 'w-[42px]'}`}
                            >
                                <button
                                    type="button"
                                    onClick={() => { 
                                        setIsSearchExpanded(true); 
                                        setTimeout(() => searchInputRef.current?.focus(), 100); 
                                    }}
                                    className={`absolute left-0 z-10 grid h-[42px] w-[42px] place-items-center rounded-2xl text-dash-teal transition-all ${isSearchExpanded || searchQuery ? 'pointer-events-none bg-transparent' : 'cursor-pointer border border-dash-border bg-dash-card shadow-sm hover:-translate-y-0.5 hover:border-dash-teal/40 hover:bg-dash-teal-light hover:shadow-md'}`}
                                    title="Rechercher"
                                    aria-label="Rechercher"
                                >
                                    <Search className="h-[18px] w-[18px]" />
                                </button>
                                 
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Rechercher dans tout le contenu…"
                                    value={searchQuery}
                                    onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(6); }}
                                    onFocus={() => setIsSearchFocused(true)}
                                    onBlur={() => {
                                        setIsSearchFocused(false);
                                        if (!searchQuery) setIsSearchExpanded(false);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Escape') {
                                            setSearchQuery('');
                                            setIsSearchExpanded(false);
                                            searchInputRef.current?.blur();
                                        }
                                    }}
                                    className={`h-[42px] w-full rounded-2xl border border-dash-border bg-white/95 py-2 pl-10 pr-20 text-[13px] font-semibold text-dash-main shadow-sm outline-none backdrop-blur-xl transition-all placeholder:font-medium placeholder:text-dash-muted/80 hover:border-dash-teal/40 focus:border-dash-teal focus:shadow-[0_10px_30px_rgba(25,120,140,0.12)] focus:ring-4 focus:ring-dash-teal/10 ${isSearchExpanded || searchQuery ? 'cursor-text opacity-100' : 'pointer-events-none cursor-default opacity-0'}`}
                                    aria-label="Recherche avancée dans toutes les fiches"
                                />
                                {(isSearchExpanded || searchQuery) && (
                                    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                                        {searchQuery && (
                                            <span className="hidden rounded-md bg-dash-teal-light px-1.5 py-0.5 text-[9px] font-extrabold tabular-nums text-dash-teal sm:inline">
                                                {searchQuery !== deferredSearchQuery ? '…' : sortedWorksheets.length}
                                            </span>
                                        )}
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                                                className="grid h-7 w-7 place-items-center rounded-lg text-dash-muted transition hover:bg-dash-bg hover:text-dash-main"
                                                aria-label="Effacer la recherche"
                                                title="Effacer"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                        {!searchQuery && <kbd className="hidden rounded-md border border-dash-border bg-dash-bg px-1.5 py-0.5 text-[9px] font-bold text-dash-muted sm:block">Ctrl K</kbd>}
                                    </div>
                                )}

                                {isSearchFocused && (isSearchExpanded || searchQuery) && (
                                    <div className="absolute right-0 top-[50px] w-full min-w-[300px] overflow-hidden rounded-2xl border border-dash-border/90 bg-white/95 p-3 shadow-[0_20px_55px_rgba(23,33,38,0.16)] backdrop-blur-xl">
                                        <div className="flex items-center gap-2 text-[11px] font-extrabold text-dash-main">
                                            <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-cyan-100 to-blue-100 text-dash-teal">
                                                <Sparkles className="h-3.5 w-3.5" />
                                            </span>
                                            Recherche intelligente dans toute la fiche
                                        </div>
                                        <p className="mt-2 text-[10px] font-medium leading-relaxed text-dash-muted">
                                            Titres, énoncés, questions, réponses, solutions et aides. Accents et petites fautes sont tolérés.
                                        </p>
                                        <div className="mt-2.5 flex flex-wrap gap-1.5 text-[9px] font-bold text-dash-teal">
                                            {['"phrase exacte"', 'solution:preuve', 'classe:terminale', 'question:fonction'].map(example => (
                                                <button
                                                    key={example}
                                                    type="button"
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onClick={() => { setSearchQuery(example); searchInputRef.current?.focus(); }}
                                                    className="rounded-full border border-dash-teal/15 bg-dash-teal-light px-2 py-1 transition hover:border-dash-teal/35 hover:bg-dash-teal-hover"
                                                >
                                                    {example}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleOpenManager}
                                className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-dash-main text-white shadow-[0_4px_12px_rgba(23,33,38,0.12)] transition hover:-translate-y-0.5 hover:bg-[oklch(0.28_0.03_240)] focus:outline-none focus:ring-4 focus:ring-dash-teal/20"
                                title="Créer une nouvelle fiche"
                                aria-label="Créer une nouvelle fiche"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                    </header>

                    {sortedWorksheets.length > 0 ? (
                    <>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-5">
                            {visibleWorksheets.map((ws) => (
                                <WorksheetCard
                                    key={ws.id}
                                    worksheet={ws}
                                    renamingId={renamingId}
                                    newName={newName}
                                    onSelectWorksheet={onSelectWorksheet}
                                    onSaveRename={handleSaveRename}
                                    onNewNameChange={setNewName}
                                    onShowInfo={setInfoModalWorksheet}
                                    fallbackPaperTheme={defaultPaperTheme}
                                    searchMatch={searchMatches.get(ws.id)}
                                />
                            ))}
                        </div>

                            {visibleCount < sortedWorksheets.length && (
                                <div className="mt-12 text-center">
                                    <button
                                        type="button"
                                        onClick={() => setVisibleCount(prev => prev + 6)}
                                        className="rounded-full border border-dash-border bg-dash-card px-8 py-3 text-sm font-bold text-dash-main transition hover:border-dash-teal hover:bg-dash-teal-light hover:text-dash-teal focus:outline-none focus:ring-4 focus:ring-dash-teal/10"
                                    >
                                        Voir plus
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="rounded-[28px] border border-dashed border-dash-border bg-dash-card px-6 py-20 text-center">
                            {searchQuery ? (
                                <>
                                    <Search className="mx-auto mb-4 h-10 w-10 text-dash-muted" />
                                    <h2 className="font-display text-xl font-bold text-dash-main">Aucun résultat</h2>
                                    <p className="mt-2 text-base font-semibold text-dash-muted">Essayez avec d'autres mots-clés.</p>
                                </>
                            ) : treeFilter ? (
                                <>
                                    <Folder className="mx-auto mb-4 h-10 w-10 text-dash-muted" />
                                    <h2 className="font-display text-xl font-bold text-dash-main">Aucune fiche dans cette sélection</h2>
                                    <button type="button" onClick={() => { setTreeFilter(null); setVisibleCount(6); }} className="mt-5 text-sm font-bold text-dash-teal transition hover:underline">Tout afficher</button>
                                </>
                            ) : (
                                <>
                                    <FileText className="mx-auto mb-4 h-10 w-10 text-dash-muted" />
                                    <h2 className="font-display text-xl font-bold text-dash-main">Aucune fiche</h2>
                                    <p className="mt-2 text-base font-semibold text-dash-muted">Importez un fichier JSON ou créez une nouvelle fiche pour commencer.</p>
                                    <button
                                        type="button"
                                        onClick={handleOpenManager}
                                        className="mt-6 inline-flex items-center gap-2 rounded-full bg-dash-main px-6 py-3 font-bold text-white transition hover:bg-[oklch(0.28_0.03_240)] focus:outline-none focus:ring-4 focus:ring-dash-teal/20"
                                    >
                                        <Plus className="h-5 w-5" />
                                        Créer une fiche
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {isManagerModalOpen && (
                <React.Suspense fallback={null}>
                    <JSONManagerModal
                        isOpen
                        onClose={() => setIsManagerModalOpen(false)}
                        worksheets={worksheets}
                        onRestoreBackup={onRestoreBackup}
                        onSaveWorksheet={handleJsonSave}
                        initialValue={jsonMode === 'edit' && editingWorksheet ? editingWorksheet.content : undefined}
                        mode={jsonMode}
                    />
                </React.Suspense>
            )}

            {infoModalWorksheet && (
                <React.Suspense fallback={null}>
                    <WorksheetInfoModal
                        worksheet={worksheets.find(w => w.id === infoModalWorksheet.id) || infoModalWorksheet}
                        worksheetClasses={worksheetClasses}
                        onClose={() => setInfoModalWorksheet(null)}
                        getClassName={getWorksheetClassName}
                        onRenameWorksheet={onRenameWorksheet}
                        onEditJson={handleEditJson}
                        onDeleteWorksheet={handleDeleteWorksheet}
                        onSelectWorksheet={onSelectWorksheet}
                        onAssignWorksheetClass={onAssignWorksheetClass}
                        fallbackPaperTheme={defaultPaperTheme}
                    />
                </React.Suspense>
            )}

            {isHelpModalOpen && (
                <React.Suspense fallback={null}>
                    <HelpModal isOpen onClose={() => setIsHelpModalOpen(false)} />
                </React.Suspense>
            )}

            {!isOnline && (
                <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg no-print">
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    Mode Hors-Ligne — Vos fiches locales restent accessibles.
                </div>
            )}

        </div>
    );
};

export default Dashboard;
