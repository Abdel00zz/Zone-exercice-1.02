import React, { useState, useMemo, useRef } from 'react';
import type { Worksheet, WorksheetContent } from '../types';
import { Search, Folder, FileText, Plus, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import JSONManagerModal from './JSONManagerModal';
import WorksheetCard from './WorksheetCard';
import WorksheetInfoModal from './WorksheetInfoModal';
import DashboardSidebar from './DashboardSidebar';
import HelpModal from './HelpModal';
import type { CloudSyncStatus } from '../hooks/useCloudSync';
import { 
    getWorksheetClassName, 
    getWorksheetChapterName, 
    buildWorksheetTree, 
    generateDynamicSubtitle,
    normalizeWorksheetJson,
    type TreeFilter 
} from '../utils/worksheetUtils';

interface DashboardProps {
    worksheets: Worksheet[];
    worksheetClasses: string[];
    onSelectWorksheet: (id: string) => void;
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
    cloudSyncStatus
}) => {
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [visibleCount, setVisibleCount] = useState(6);
    
    const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
    const [infoModalWorksheet, setInfoModalWorksheet] = useState<Worksheet | null>(null);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
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
    const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
    const [treeFilter, setTreeFilter] = useState<TreeFilter>(null);

    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

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

    const handleRename = (worksheet: Worksheet) => {
        setRenamingId(worksheet.id);
        setNewName(worksheet.name);
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

    const filteredWorksheets = useMemo(() => {
        const normalizedSearch = searchQuery.trim().toLocaleLowerCase('fr');

        return worksheets.filter((worksheet) => {
            const className = getWorksheetClassName(worksheet);
            const chapterName = getWorksheetChapterName(worksheet);
            const isInSelectedBranch = !treeFilter
                || (treeFilter.type === 'class' && className === treeFilter.className)
                || (treeFilter.type === 'chapter' && className === treeFilter.className && chapterName === treeFilter.chapterName)
                || (treeFilter.type === 'worksheet' && worksheet.id === treeFilter.worksheetId);

            if (!isInSelectedBranch || !normalizedSearch) return isInSelectedBranch;

            return [worksheet.name, worksheet.content?.chapter, className]
                .filter(Boolean)
                .some((value) => value!.toLocaleLowerCase('fr').includes(normalizedSearch));
        });
    }, [worksheets, searchQuery, treeFilter]);

    const sortedWorksheets = useMemo(() => {
        return [...filteredWorksheets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [filteredWorksheets]);

    const dynamicSubtitle = useMemo(() => {
        return generateDynamicSubtitle(searchQuery, treeFilter, sortedWorksheets.length, worksheets);
    }, [searchQuery, treeFilter, sortedWorksheets.length, worksheets]);

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
        <div className="min-h-screen bg-[#f2f0eb] text-[#172126]">
            <div className={`relative mx-auto grid min-h-screen w-full max-w-[1680px] content-start transition-[grid-template-columns] duration-300 lg:content-normal ${sidebarCollapsed ? 'lg:grid-cols-[0px_minmax(0,1fr)]' : 'lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)]'}`}>
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
                        <div className="flex items-center gap-2.5 min-w-0">
                            <button
                                type="button"
                                onClick={() => setSidebarCollapsed((current) => !current)}
                                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#19788c]/10 text-[#19788c] transition hover:bg-[#19788c]/20 hover:text-[#11677a] focus:outline-none"
                                title={sidebarCollapsed ? 'Développer la barre latérale' : 'Réduire la barre latérale'}
                                aria-label={sidebarCollapsed ? 'Développer la barre latérale' : 'Réduire la barre latérale'}
                            >
                                {sidebarCollapsed ? <PanelLeftOpen className="h-4.5 w-4.5" /> : <PanelLeftClose className="h-4.5 w-4.5" />}
                            </button>
                            <div className="block min-w-0">
                                <h2 className="font-serif text-lg font-semibold tracking-[-0.02em] text-[#111719] sm:text-xl md:text-2xl">
                                    Mes Fiches d'Exercices
                                </h2>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <p className="text-xs font-semibold text-[#697478]">
                                        {dynamicSubtitle}
                                    </p>
                                    {(treeFilter || searchQuery) && (
                                        <button 
                                            type="button" 
                                            onClick={() => { setTreeFilter(null); setSearchQuery(''); setVisibleCount(6); }} 
                                            className="rounded-full bg-[#19788c]/10 px-2 py-0.5 text-[11px] font-bold text-[#19788c] transition hover:bg-[#19788c]/20 hover:text-[#11677a]" 
                                            title="Réinitialiser le filtre"
                                        >
                                            Tout afficher
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center h-[38px] justify-end">
                            <div 
                                className={`relative flex items-center transition-all duration-300 ease-in-out ${isSearchExpanded || searchQuery ? 'w-full sm:w-[210px] lg:w-[240px]' : 'w-[38px]'}`}
                            >
                                <button
                                    type="button"
                                    onClick={() => { 
                                        setIsSearchExpanded(true); 
                                        setTimeout(() => searchInputRef.current?.focus(), 100); 
                                    }}
                                    className={`absolute left-0 z-10 grid h-[38px] w-[38px] place-items-center rounded-full text-[#19788c] transition-colors ${isSearchExpanded || searchQuery ? 'pointer-events-none' : 'cursor-pointer bg-[#faf9f6] border border-[#d5d8d4] hover:bg-[#19788c]/5'}`}
                                    title="Rechercher"
                                    aria-label="Rechercher"
                                >
                                    <Search className="h-4 w-4" />
                                </button>
                                
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Rechercher..."
                                    value={searchQuery}
                                    onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(6); }}
                                    onBlur={() => { if (!searchQuery) setIsSearchExpanded(false); }}
                                    className={`h-[38px] w-full rounded-full border border-[#d5d8d4] bg-[#faf9f6] py-1.5 pl-9 pr-3 text-xs font-semibold text-[#172126] outline-none transition-all placeholder:text-[#8a9293] hover:border-[#b9c8c8] focus:border-[#19788c] focus:ring-4 focus:ring-[#19788c]/10 ${isSearchExpanded || searchQuery ? 'opacity-100 cursor-text' : 'opacity-0 cursor-default pointer-events-none'}`}
                                    aria-label="Rechercher une fiche par nom"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleOpenManager}
                                className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-[#172126] text-white shadow-[0_4px_12px_rgba(23,33,38,0.12)] transition hover:-translate-y-0.5 hover:bg-[#25363c] focus:outline-none focus:ring-4 focus:ring-[#19788c]/20"
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
                                />
                            ))}
                        </div>

                            {visibleCount < sortedWorksheets.length && (
                                <div className="mt-12 text-center">
                                    <button
                                        type="button"
                                        onClick={() => setVisibleCount(prev => prev + 6)}
                                        className="rounded-full border border-[#cfd4d1] bg-[#faf9f6] px-8 py-3 text-sm font-bold text-[#364246] transition hover:border-[#19788c] hover:bg-[#e7f0ef] hover:text-[#19788c] focus:outline-none focus:ring-4 focus:ring-[#19788c]/10"
                                    >
                                        Voir plus
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="rounded-[28px] border border-dashed border-[#c9cdc8] bg-[#faf9f6] px-6 py-20 text-center">
                            {searchQuery ? (
                                <>
                                    <Search className="mx-auto mb-4 h-10 w-10 text-[#a6aeae]" />
                                    <h2 className="font-display text-xl font-bold text-[#4f5a5d]">Aucun résultat</h2>
                                    <p className="mt-2 text-base font-semibold text-[#7a8385]">Essayez avec d'autres mots-clés.</p>
                                </>
                            ) : treeFilter ? (
                                <>
                                    <Folder className="mx-auto mb-4 h-10 w-10 text-[#a6aeae]" />
                                    <h2 className="font-display text-xl font-bold text-[#4f5a5d]">Aucune fiche dans cette sélection</h2>
                                    <button type="button" onClick={() => { setTreeFilter(null); setVisibleCount(6); }} className="mt-5 text-sm font-bold text-[#19788c] transition hover:text-[#11677a]">Tout afficher</button>
                                </>
                            ) : (
                                <>
                                    <FileText className="mx-auto mb-4 h-10 w-10 text-[#a6aeae]" />
                                    <h2 className="font-display text-xl font-bold text-[#4f5a5d]">Aucune fiche</h2>
                                    <p className="mt-2 text-base font-semibold text-[#7a8385]">Importez un fichier JSON ou créez une nouvelle fiche pour commencer.</p>
                                    <button
                                        type="button"
                                        onClick={handleOpenManager}
                                        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#172126] px-6 py-3 font-bold text-white transition hover:bg-[#25363c] focus:outline-none focus:ring-4 focus:ring-[#19788c]/20"
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

            <JSONManagerModal 
                isOpen={isManagerModalOpen}
                onClose={() => setIsManagerModalOpen(false)}
                worksheets={worksheets}
                onRestoreBackup={onRestoreBackup}
                onSaveWorksheet={handleJsonSave}
                initialValue={jsonMode === 'edit' && editingWorksheet ? editingWorksheet.content : undefined}
                mode={jsonMode}
            />

            <WorksheetInfoModal
                worksheet={infoModalWorksheet ? (worksheets.find(w => w.id === infoModalWorksheet.id) || infoModalWorksheet) : null}
                worksheetClasses={worksheetClasses}
                onClose={() => setInfoModalWorksheet(null)}
                getClassName={getWorksheetClassName}
                onRenameWorksheet={onRenameWorksheet}
                onEditJson={handleEditJson}
                onDeleteWorksheet={handleDeleteWorksheet}
                onSelectWorksheet={onSelectWorksheet}
                onAssignWorksheetClass={onAssignWorksheetClass}
            />

            <HelpModal 
                isOpen={isHelpModalOpen}
                onClose={() => setIsHelpModalOpen(false)}
            />

        </div>
    );
};

export default Dashboard;
