import React from 'react';
import type { Worksheet } from '../types';
import type { CloudSyncStatus } from '../hooks/useCloudSync';
import type { TreeFilter, WorksheetTreeClass } from '../utils/worksheetUtils';
import { 
    Cloud, Settings, Folder, FolderPlus, ChevronDown, 
    BookOpen, FileText, FolderInput, Pencil, Trash2, 
    ChevronRight, PanelLeftOpen, HelpCircle
} from 'lucide-react';

interface DashboardSidebarProps {
    sidebarCollapsed: boolean;
    setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
    cloudSyncStatus: CloudSyncStatus;
    onOpenSyncPanel: () => void;
    onOpenConfiguration: () => void;
    onOpenHelp: () => void;
    worksheetTree: WorksheetTreeClass[];
    isCreatingClass: boolean;
    setIsCreatingClass: (creating: boolean) => void;
    newClassName: string;
    setNewClassName: (name: string) => void;
    handleCreateClass: (event: React.FormEvent) => void;
    collapsedClasses: Record<string, boolean>;
    setCollapsedClasses: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    expandedChapters: Record<string, boolean>;
    setExpandedChapters: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    treeFilter: TreeFilter;
    treeRename: { type: 'class' | 'chapter' | 'worksheet'; className?: string; chapterName?: string; worksheetId?: string } | null;
    treeRenameValue: string;
    setTreeRenameValue: (val: string) => void;
    saveTreeRename: () => void;
    cancelTreeRename: () => void;
    startTreeRename: (target: { type: 'class' | 'chapter' | 'worksheet'; className?: string; chapterName?: string; worksheetId?: string }, value: string) => void;
    selectTreeClass: (className: string) => void;
    selectTreeChapter: (className: string, chapterName: string) => void;
    selectTreeWorksheet: (worksheetId: string) => void;
    handleDeleteClass: (className: string) => void;
    handleDeleteWorksheet: (worksheetId: string) => void;
    movingWorksheetId: string | null;
    setMovingWorksheetId: React.Dispatch<React.SetStateAction<string | null>>;
    worksheetClasses: string[];
    onAssignWorksheetClass: (worksheetId: string, className: string) => void;
    onSelectWorksheet: (id: string) => void;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
    sidebarCollapsed,
    setSidebarCollapsed,
    cloudSyncStatus,
    onOpenSyncPanel,
    onOpenConfiguration,
    onOpenHelp,
    worksheetTree,
    isCreatingClass,
    setIsCreatingClass,
    newClassName,
    setNewClassName,
    handleCreateClass,
    collapsedClasses,
    setCollapsedClasses,
    expandedChapters,
    setExpandedChapters,
    treeFilter,
    treeRename,
    treeRenameValue,
    setTreeRenameValue,
    saveTreeRename,
    cancelTreeRename,
    startTreeRename,
    selectTreeClass,
    selectTreeChapter,
    selectTreeWorksheet,
    handleDeleteClass,
    handleDeleteWorksheet,
    movingWorksheetId,
    setMovingWorksheetId,
    worksheetClasses,
    onAssignWorksheetClass,
    onSelectWorksheet,
}) => {
    return (
        <aside className={`min-w-0 bg-dash-sidebar border-r border-dash-border/40 px-3.5 pt-3.5 pb-5 sm:px-4 sm:pt-3.5 sm:pb-6 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:pt-3.5 lg:pb-6 ${sidebarCollapsed ? 'lg:w-0 lg:overflow-hidden lg:p-0 lg:opacity-0 lg:pointer-events-none' : 'lg:px-3.5 xl:px-4'}`}>
            <div className="flex flex-col xl:h-full">
                <nav className="grid gap-2 grid-cols-1" aria-label="Actions du tableau de bord">
                    <button
                        type="button"
                        onClick={onOpenSyncPanel}
                        className={`relative flex items-center rounded-xl bg-dash-card border border-dash-border/60 text-left text-dash-main transition hover:bg-dash-teal-light hover:text-dash-teal hover:border-dash-teal/30 focus:outline-none focus:ring-4 focus:ring-dash-teal/10 ${sidebarCollapsed ? 'h-11 justify-center' : 'h-[44px] gap-3 px-3.5'}`}
                        title="Synchronisation PC / Tablette"
                        aria-label="Synchronisation PC / Tablette"
                    >
                        <span className="relative text-dash-teal shrink-0">
                            <Cloud className="h-4.5 w-4.5" />
                            {cloudSyncStatus !== 'disconnected' && (
                                <span
                                    className={`absolute -right-1 -top-0.5 h-2 w-2 rounded-full border border-white ${
                                        cloudSyncStatus === 'error' ? 'bg-red-500' : cloudSyncStatus === 'syncing' ? 'bg-amber-400' : 'bg-emerald-500'
                                    }`}
                                />
                            )}
                        </span>
                        <span className={sidebarCollapsed ? 'sr-only' : 'text-xs font-bold text-dash-main truncate'}>Sync PC / Tablette</span>
                    </button>

                    <button
                        type="button"
                        onClick={onOpenConfiguration}
                        className={`flex items-center rounded-xl bg-dash-card border border-dash-border/60 text-left text-dash-main transition hover:bg-dash-teal-light hover:text-dash-teal hover:border-dash-teal/30 focus:outline-none focus:ring-4 focus:ring-dash-teal/10 ${sidebarCollapsed ? 'h-11 justify-center' : 'h-[44px] gap-3 px-3.5'}`}
                        title="Configuration"
                        aria-label="Configuration"
                    >
                        <Settings className="h-4.5 w-4.5 text-dash-muted shrink-0" />
                        <span className={sidebarCollapsed ? 'sr-only' : 'text-xs font-bold truncate'}>Configuration</span>
                    </button>

                    <button
                        type="button"
                        onClick={onOpenHelp}
                        className={`flex items-center rounded-xl bg-dash-card border border-dash-border/60 text-left text-dash-main transition hover:bg-dash-teal-light hover:text-dash-teal hover:border-dash-teal/30 focus:outline-none focus:ring-4 focus:ring-dash-teal/10 ${sidebarCollapsed ? 'h-11 justify-center' : 'h-[44px] gap-3 px-3.5'}`}
                        title="Aide & Guide / Help & Guide / المساعدة والدليل"
                        aria-label="Aide & Guide / Help"
                    >
                        <HelpCircle className="h-4.5 w-4.5 text-dash-teal shrink-0" />
                        <span className={sidebarCollapsed ? 'sr-only' : 'text-xs font-bold truncate'}>Aide & Guide</span>
                    </button>
                </nav>

                {worksheetTree.length > 0 && (
                    <section className="mt-6 hidden lg:block" aria-labelledby="class-tree-title">
                        {sidebarCollapsed ? (
                            <div className="flex flex-col items-center gap-2" aria-label="Classes réduites">
                                <button type="button" onClick={() => { setSidebarCollapsed(false); setIsCreatingClass(true); }} className="grid h-10 w-10 place-items-center rounded-xl text-dash-sage transition hover:bg-dash-sage-light focus:outline-none focus:ring-2 focus:ring-dash-sage/20" title="Créer une classe" aria-label="Créer une classe"><FolderPlus className="h-4 w-4" /></button>
                                {worksheetTree.map(({ className, worksheetCount }) => (
                                    <button key={className} type="button" onClick={() => setSidebarCollapsed(false)} className="relative grid h-10 w-10 place-items-center rounded-xl text-dash-teal transition hover:bg-dash-teal-light focus:outline-none focus:ring-2 focus:ring-dash-teal/20" title={`${className} — ${worksheetCount} fiche${worksheetCount !== 1 ? 's' : ''}`} aria-label={`${className} — ${worksheetCount} fiche${worksheetCount !== 1 ? 's' : ''}`}><Folder className="h-4 w-4" /><span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-dash-main px-1 text-[8px] font-bold text-white">{worksheetCount}</span></button>
                                ))}
                            </div>
                        ) : (
                        <>
                        <div className="mb-3 flex items-center justify-between gap-2 px-1">
                            <h2 id="class-tree-title" className="flex items-center gap-2 font-serif text-lg font-semibold tracking-[-0.025em] text-dash-main">
                                <Folder className="h-4 w-4 text-dash-teal" />
                                Mes Classes
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsCreatingClass(true)}
                                className="grid h-7 w-7 place-items-center rounded-lg bg-dash-sage-light text-dash-sage transition hover:bg-dash-sage-light/80 focus:outline-none focus:ring-2 focus:ring-dash-sage/20"
                                title="Créer une classe"
                                aria-label="Créer une classe"
                            >
                                <FolderPlus className="h-4 w-4" />
                            </button>
                        </div>

                        {isCreatingClass && (
                            <form onSubmit={handleCreateClass} className="mb-2.5 flex items-center gap-1.5 rounded-xl border border-dash-sage/30 bg-dash-sage-light/70 p-2 shadow-xs">
                                <input
                                    autoFocus
                                    value={newClassName}
                                    onChange={(event) => setNewClassName(event.target.value)}
                                    onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setIsCreatingClass(false); setNewClassName(''); } }}
                                    placeholder="Nom de la classe (ex: 3ème A)"
                                    className="min-w-0 flex-1 bg-transparent px-1 text-xs font-bold text-dash-main outline-none placeholder:text-dash-sage/70"
                                    aria-label="Nom de la nouvelle classe"
                                />
                                <button type="submit" className="rounded-lg bg-dash-sage px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-dash-sage/90">Créer</button>
                            </form>
                        )}

                        <div className="space-y-1" role="tree" aria-label="Classe, chapitre et fiche">
                            {worksheetTree.map(({ className, worksheetCount, chapters }) => {
                                const isClassSelected = treeFilter?.type === 'class' && treeFilter.className === className;
                                // Réduit par défaut à la connexion, sauf si sélectionné explicitement
                                const classCollapsed = collapsedClasses[className] !== undefined 
                                    ? collapsedClasses[className] 
                                    : !isClassSelected;
                                const isClassRenaming = treeRename?.type === 'class' && treeRename.className === className;
                                const isUnclassified = className === 'Non classé';

                                return (
                                    <div key={className} role="treeitem" aria-expanded={!classCollapsed} className="group/class">
                                        <div className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 transition-all ${isClassSelected ? 'bg-dash-teal-light text-dash-teal font-bold border-l-2 border-dash-teal shadow-xs' : 'hover:bg-dash-card border-l-2 border-transparent'}`}>
                                            <button
                                                type="button"
                                                onClick={() => setCollapsedClasses((current) => ({ ...current, [className]: !classCollapsed }))}
                                                className="grid h-6 w-5 shrink-0 place-items-center rounded-md text-dash-muted hover:text-dash-teal focus:outline-none focus:ring-2 focus:ring-dash-teal/15 transition-colors"
                                                aria-label={`${classCollapsed ? 'Afficher' : 'Masquer'} ${className}`}
                                            >
                                                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${classCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                                            </button>
                                            <Folder className="h-4 w-4 shrink-0 text-dash-teal" />
                                            {isClassRenaming ? (
                                                <form onSubmit={(event) => { event.preventDefault(); saveTreeRename(); }} className="min-w-0 flex-1">
                                                    <input
                                                        autoFocus
                                                        value={treeRenameValue}
                                                        onChange={(event) => setTreeRenameValue(event.target.value)}
                                                        onBlur={saveTreeRename}
                                                        onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); cancelTreeRename(); } }}
                                                        className="w-full border-b border-dash-teal bg-transparent text-xs font-bold text-dash-main outline-none"
                                                        aria-label="Renommer la classe"
                                                    />
                                                </form>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => selectTreeClass(className)}
                                                    onDoubleClick={() => !isUnclassified && startTreeRename({ type: 'class', className }, className)}
                                                    className="min-w-0 flex-1 truncate text-left text-xs font-bold text-dash-main outline-none hover:text-dash-teal transition-colors"
                                                    title={isUnclassified ? className : 'Double-cliquez pour renommer'}
                                                >
                                                    {className}
                                                </button>
                                            )}
                                            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-dash-bg px-1.5 text-[10px] font-bold text-dash-muted">{worksheetCount}</span>
                                            {!isUnclassified && (
                                                <div className="flex items-center opacity-0 transition-opacity group-hover/class:opacity-100 group-focus-within/class:opacity-100">
                                                    <button type="button" onClick={() => startTreeRename({ type: 'class', className }, className)} className="grid h-5 w-5 place-items-center rounded text-dash-muted hover:bg-dash-teal-light hover:text-dash-teal" aria-label="Renommer la classe"><Pencil className="h-3 w-3" /></button>
                                                    <button type="button" onClick={() => handleDeleteClass(className)} className="grid h-5 w-5 place-items-center rounded text-dash-muted hover:bg-red-50 hover:text-red-600" aria-label="Supprimer la classe"><Trash2 className="h-3 w-3" /></button>
                                                </div>
                                            )}
                                        </div>

                                        <div className={`grid transition-all duration-200 ease-out ${classCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
                                            <div className="overflow-hidden">
                                                <div className="ml-3 my-1 pl-2.5 border-l-2 border-dash-border/50 space-y-1" role="group">
                                                    {chapters.map(({ chapterName, worksheets: chapterWorksheets }) => {
                                                        const chapterKey = `${className}::${chapterName}`;
                                                        const isChapterSelected = treeFilter?.type === 'chapter' && treeFilter.className === className && treeFilter.chapterName === chapterName;
                                                        // Réduit par défaut à la connexion sauf si sélectionné
                                                        const chapterExpanded = expandedChapters[chapterKey] !== undefined 
                                                            ? expandedChapters[chapterKey] 
                                                            : isChapterSelected;
                                                        const isChapterRenaming = treeRename?.type === 'chapter' && treeRename.className === className && treeRename.chapterName === chapterName;

                                                        return (
                                                            <div key={chapterKey} role="treeitem" aria-expanded={chapterExpanded} className="group/chapter">
                                                                <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 transition-all ${isChapterSelected ? 'bg-dash-teal-light/80 text-dash-teal font-bold' : 'hover:bg-dash-card'}`}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setExpandedChapters((current) => ({
                                                                            ...current,
                                                                            [chapterKey]: !chapterExpanded,
                                                                        }))}
                                                                        className="grid h-6 w-5 shrink-0 place-items-center rounded-md text-dash-muted hover:text-dash-teal focus:outline-none focus:ring-2 focus:ring-dash-teal/15 transition-colors"
                                                                        aria-label={`${chapterExpanded ? 'Masquer' : 'Afficher'} les fiches de ${chapterName}`}
                                                                    >
                                                                        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${chapterExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                                                    </button>
                                                                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-dash-sage" />
                                                                    {isChapterRenaming ? (
                                                                        <form onSubmit={(event) => { event.preventDefault(); saveTreeRename(); }} className="min-w-0 flex-1">
                                                                            <input autoFocus value={treeRenameValue} onChange={(event) => setTreeRenameValue(event.target.value)} onBlur={saveTreeRename} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); cancelTreeRename(); } }} className="w-full border-b border-dash-teal bg-transparent text-xs font-bold text-dash-main outline-none" aria-label="Renommer le chapitre" />
                                                                        </form>
                                                                    ) : (
                                                                        <button type="button" onClick={() => selectTreeChapter(className, chapterName)} onDoubleClick={() => startTreeRename({ type: 'chapter', className, chapterName }, chapterName)} className="min-w-0 flex-1 truncate py-1 text-left text-xs font-semibold text-dash-main hover:text-dash-teal transition-colors outline-none" title="Double-cliquez pour renommer">
                                                                            {chapterName}
                                                                        </button>
                                                                    )}
                                                                    <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-dash-bg px-1 text-[9px] font-bold text-dash-muted">{chapterWorksheets.length}</span>
                                                                    <div className="flex items-center opacity-0 transition-opacity group-hover/chapter:opacity-100 group-focus-within/chapter:opacity-100">
                                                                        <button type="button" onClick={() => startTreeRename({ type: 'chapter', className, chapterName }, chapterName)} className="grid h-5 w-5 place-items-center rounded text-dash-muted hover:bg-dash-teal-light hover:text-dash-teal" aria-label="Renommer le chapitre"><Pencil className="h-3 w-3" /></button>
                                                                    </div>
                                                                </div>

                                                                <div className={`grid transition-all duration-200 ease-out ${chapterExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                                                    <div className="overflow-hidden">
                                                                        <div className="ml-3 my-0.5 pl-2.5 border-l-2 border-dash-border/30 space-y-0.5" role="group">
                                                                            {chapterWorksheets.map((worksheet) => {
                                                                                const isWorksheetRenaming = treeRename?.type === 'worksheet' && treeRename.worksheetId === worksheet.id;
                                                                                const isWorksheetSelected = treeFilter?.type === 'worksheet' && treeFilter.worksheetId === worksheet.id;

                                                                                return (
                                                                                    <div key={worksheet.id} className={`group/fiche relative flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-dash-muted transition hover:bg-dash-card hover:text-dash-teal ${isWorksheetSelected ? 'bg-dash-teal-light text-dash-teal font-bold' : ''}`}>
                                                                                        <FileText className="h-3.5 w-3.5 shrink-0" />
                                                                                        {isWorksheetRenaming ? (
                                                                                            <form onSubmit={(event) => { event.preventDefault(); saveTreeRename(); }} className="min-w-0 flex-1">
                                                                                                <input autoFocus value={treeRenameValue} onChange={(event) => setTreeRenameValue(event.target.value)} onBlur={saveTreeRename} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); cancelTreeRename(); } }} className="w-full border-b border-dash-teal bg-transparent text-[11px] font-semibold text-dash-main outline-none" aria-label="Renommer la fiche" />
                                                                                            </form>
                                                                                        ) : (
                                                                                            <button type="button" onClick={() => selectTreeWorksheet(worksheet.id)} onDoubleClick={() => startTreeRename({ type: 'worksheet', worksheetId: worksheet.id }, worksheet.name)} className="min-w-0 flex-1 truncate text-left outline-none hover:underline" title="Double-cliquez pour renommer">{worksheet.name}</button>
                                                                                        )}
                                                                                        <div className="flex items-center opacity-0 transition-opacity group-hover/fiche:opacity-100 group-focus-within/fiche:opacity-100">
                                                                                            <button type="button" onClick={() => setMovingWorksheetId((current) => current === worksheet.id ? null : worksheet.id)} className="grid h-5 w-5 place-items-center rounded hover:bg-dash-sage-light hover:text-dash-sage" title="Déplacer vers une classe" aria-label="Déplacer vers une classe"><FolderInput className="h-3 w-3" /></button>
                                                                                            <button type="button" onClick={() => startTreeRename({ type: 'worksheet', worksheetId: worksheet.id }, worksheet.name)} className="grid h-5 w-5 place-items-center rounded hover:bg-dash-teal-light" aria-label="Renommer la fiche"><Pencil className="h-3 w-3" /></button>
                                                                                            <button type="button" onClick={() => handleDeleteWorksheet(worksheet.id)} className="grid h-5 w-5 place-items-center rounded hover:bg-red-50 hover:text-red-600" aria-label="Supprimer la fiche"><Trash2 className="h-3 w-3" /></button>
                                                                                            <button type="button" onClick={() => onSelectWorksheet(worksheet.id)} className="grid h-5 w-5 place-items-center rounded hover:bg-dash-teal-light" aria-label="Ouvrir la fiche"><ChevronRight className="h-3.5 w-3.5" /></button>
                                                                                        </div>

                                                                                        {movingWorksheetId === worksheet.id && (
                                                                                            <select
                                                                                                autoFocus
                                                                                                value={worksheet.content.settings?.className || ''}
                                                                                                onChange={(event) => { onAssignWorksheetClass(worksheet.id, event.target.value); setMovingWorksheetId(null); }}
                                                                                                onBlur={() => setMovingWorksheetId(null)}
                                                                                                className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-dash-border bg-white px-2 py-1 text-[11px] font-bold text-dash-main shadow-sm outline-none"
                                                                                                aria-label="Choisir la classe de la fiche"
                                                                                            >
                                                                                                <option value="">Non classé</option>
                                                                                                {worksheetClasses.map((name) => <option key={name} value={name}>{name}</option>)}
                                                                                            </select>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        </>
                        )}
                    </section>
                )}
            </div>
        </aside>
    );
};

export default DashboardSidebar;
