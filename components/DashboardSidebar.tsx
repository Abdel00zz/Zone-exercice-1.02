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
        <aside className={`min-w-0 bg-[#fffefa] px-5 py-5 sm:px-7 sm:py-6 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:py-6 ${sidebarCollapsed ? 'lg:w-0 lg:overflow-hidden lg:p-0 lg:opacity-0 lg:pointer-events-none' : 'lg:px-4 xl:px-5'}`}>
            <div className="flex flex-col xl:h-full">
                <div className={`mb-4 flex items-start ${sidebarCollapsed ? 'justify-center' : 'justify-between gap-2'} xl:mb-5`}>
                    {sidebarCollapsed ? (
                        <button type="button" onClick={() => setSidebarCollapsed(false)} className="grid h-11 w-11 place-items-center rounded-2xl bg-[#172126] text-white shadow-sm transition hover:bg-[#25363c] focus:outline-none focus:ring-4 focus:ring-[#19788c]/15" title="Développer la barre latérale" aria-label="Développer la barre latérale">
                            <PanelLeftOpen className="h-5 w-5" />
                        </button>
                    ) : (
                        <div />
                    )}
                </div>

                <nav className="grid gap-2 grid-cols-1" aria-label="Actions du tableau de bord">
                    <button
                        type="button"
                        onClick={onOpenSyncPanel}
                        className={`relative flex rounded-xl bg-[#dceceb] text-left text-[#19788c] transition hover:bg-[#cbe4e3] focus:outline-none focus:ring-4 focus:ring-[#19788c]/15 ${sidebarCollapsed ? 'h-11 items-center justify-center' : 'h-[46px] items-center gap-3 px-4'}`}
                        title="Synchronisation PC / Tablette"
                        aria-label="Synchronisation PC / Tablette"
                    >
                        <span className="relative text-[#19788c] shrink-0">
                            <Cloud className="h-5 w-5" />
                            {cloudSyncStatus !== 'disconnected' && (
                                <span
                                    className={`absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#dceceb] ${
                                        cloudSyncStatus === 'error' ? 'bg-red-500' : cloudSyncStatus === 'syncing' ? 'bg-amber-400' : 'bg-emerald-500'
                                    }`}
                                />
                            )}
                        </span>
                        <span className={sidebarCollapsed ? 'sr-only' : 'text-[13px] font-bold text-[#435054] truncate'}>Sync PC / Tablette</span>
                    </button>

                    <button
                        type="button"
                        onClick={onOpenConfiguration}
                        className={`flex rounded-xl bg-[#f4f1eb] text-left text-[#435054] transition hover:bg-[#e7f0ef] hover:text-[#19788c] focus:outline-none focus:ring-4 focus:ring-[#19788c]/10 ${sidebarCollapsed ? 'h-11 items-center justify-center' : 'h-[46px] items-center gap-3 px-4'}`}
                        title="Configuration"
                        aria-label="Configuration"
                    >
                        <Settings className="h-5 w-5 shrink-0" />
                        <span className={sidebarCollapsed ? 'sr-only' : 'text-[13px] font-bold truncate'}>Configuration</span>
                    </button>

                    <button
                        type="button"
                        onClick={onOpenHelp}
                        className={`flex rounded-xl bg-[#eef6f5] text-left text-[#19788c] transition hover:bg-[#dceceb] hover:text-[#146070] focus:outline-none focus:ring-4 focus:ring-[#19788c]/10 ${sidebarCollapsed ? 'h-11 items-center justify-center' : 'h-[46px] items-center gap-3 px-4'}`}
                        title="Aide & Guide / Help & Guide / المساعدة والدليل"
                        aria-label="Aide & Guide / Help"
                    >
                        <HelpCircle className="h-5 w-5 shrink-0" />
                        <span className={sidebarCollapsed ? 'sr-only' : 'text-[13px] font-bold truncate'}>Aide & Guide</span>
                    </button>
                </nav>

                {worksheetTree.length > 0 && (
                    <section className="mt-7 hidden lg:block" aria-labelledby="class-tree-title">
                        {sidebarCollapsed ? (
                            <div className="flex flex-col items-center gap-2" aria-label="Classes réduites">
                                <button type="button" onClick={() => { setSidebarCollapsed(false); setIsCreatingClass(true); }} className="grid h-10 w-10 place-items-center rounded-xl text-[#81983f] transition hover:bg-[#f4f2ec] focus:outline-none focus:ring-2 focus:ring-[#81983f]/20" title="Créer une classe" aria-label="Créer une classe"><FolderPlus className="h-4 w-4" /></button>
                                {worksheetTree.map(({ className, worksheetCount }) => (
                                    <button key={className} type="button" onClick={() => setSidebarCollapsed(false)} className="relative grid h-10 w-10 place-items-center rounded-xl text-[#19788c] transition hover:bg-[#f4f2ec] focus:outline-none focus:ring-2 focus:ring-[#19788c]/20" title={`${className} — ${worksheetCount} fiche${worksheetCount !== 1 ? 's' : ''}`} aria-label={`${className} — ${worksheetCount} fiche${worksheetCount !== 1 ? 's' : ''}`}><Folder className="h-4 w-4" /><span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#172126] px-1 text-[8px] font-bold text-white">{worksheetCount}</span></button>
                                ))}
                            </div>
                        ) : (
                        <>
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <h2 id="class-tree-title" className="flex items-center gap-2 font-serif text-xl font-semibold tracking-[-0.025em] text-[#172126]">
                                <Folder className="h-4 w-4 text-[#19788c]" />
                                Mes Classes
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsCreatingClass(true)}
                                className="grid h-7 w-7 place-items-center rounded-full bg-[#e9f0df] text-[#81983f] transition hover:bg-[#dce8ca] focus:outline-none focus:ring-2 focus:ring-[#81983f]/20"
                                title="Créer une classe"
                                aria-label="Créer une classe"
                            >
                                <FolderPlus className="h-4 w-4" />
                            </button>
                        </div>

                        {isCreatingClass && (
                            <form onSubmit={handleCreateClass} className="mb-2 flex items-center gap-1.5 rounded-lg bg-[#e9f0df] p-1.5">
                                <input
                                    autoFocus
                                    value={newClassName}
                                    onChange={(event) => setNewClassName(event.target.value)}
                                    onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setIsCreatingClass(false); setNewClassName(''); } }}
                                    placeholder="Classe A"
                                    className="min-w-0 flex-1 bg-transparent px-1 text-xs font-bold text-[#364246] outline-none placeholder:text-[#8a9a71]"
                                    aria-label="Nom de la nouvelle classe"
                                />
                                <button type="submit" className="rounded-md bg-[#81983f] px-2 py-1 text-[10px] font-bold text-white">Créer</button>
                            </form>
                        )}

                        <div className="space-y-0.5" role="tree" aria-label="Classe, chapitre et fiche">
                            {worksheetTree.map(({ className, worksheetCount, chapters }) => {
                                const classCollapsed = collapsedClasses[className] === true;
                                const isClassRenaming = treeRename?.type === 'class' && treeRename.className === className;
                                const isUnclassified = className === 'Non classé';
                                const isClassSelected = treeFilter?.type === 'class' && treeFilter.className === className;

                                return (
                                    <div key={className} role="treeitem" aria-expanded={!classCollapsed} className="group/class">
                                        <div className={`flex items-center gap-1 rounded-lg px-1.5 py-1.5 transition ${isClassSelected ? 'bg-[#eef4f3] text-[#19788c]' : 'hover:bg-[#f4f2ec]'}`}>
                                            <button
                                                type="button"
                                                onClick={() => setCollapsedClasses((current) => ({ ...current, [className]: !classCollapsed }))}
                                                className="grid h-6 w-5 shrink-0 place-items-center rounded-md text-[#788284] focus:outline-none focus:ring-2 focus:ring-[#19788c]/15"
                                                aria-label={`${classCollapsed ? 'Afficher' : 'Masquer'} ${className}`}
                                            >
                                                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${classCollapsed ? '-rotate-90' : ''}`} />
                                            </button>
                                            <Folder className="h-3.5 w-3.5 shrink-0 text-[#19788c]" />
                                            {isClassRenaming ? (
                                                <form onSubmit={(event) => { event.preventDefault(); saveTreeRename(); }} className="min-w-0 flex-1">
                                                    <input
                                                        autoFocus
                                                        value={treeRenameValue}
                                                        onChange={(event) => setTreeRenameValue(event.target.value)}
                                                        onBlur={saveTreeRename}
                                                        onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); cancelTreeRename(); } }}
                                                        className="w-full border-b border-[#19788c] bg-transparent text-xs font-bold text-[#364246] outline-none"
                                                        aria-label="Renommer la classe"
                                                    />
                                                </form>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => selectTreeClass(className)}
                                                    onDoubleClick={() => !isUnclassified && startTreeRename({ type: 'class', className }, className)}
                                                    className="min-w-0 flex-1 truncate text-left text-xs font-bold text-[#364246] outline-none"
                                                    title={isUnclassified ? className : 'Double-cliquez pour renommer'}
                                                >
                                                    {className}
                                                </button>
                                            )}
                                            <span className="grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold text-[#9aa3a5]">{worksheetCount}</span>
                                            {!isUnclassified && (
                                                <div className="flex items-center opacity-0 transition-opacity group-hover/class:opacity-100 group-focus-within/class:opacity-100">
                                                    <button type="button" onClick={() => startTreeRename({ type: 'class', className }, className)} className="grid h-5 w-5 place-items-center rounded text-[#788284] hover:bg-[#e7f0ef] hover:text-[#19788c]" aria-label="Renommer la classe"><Pencil className="h-3 w-3" /></button>
                                                    <button type="button" onClick={() => handleDeleteClass(className)} className="grid h-5 w-5 place-items-center rounded text-[#788284] hover:bg-red-50 hover:text-red-600" aria-label="Supprimer la classe"><Trash2 className="h-3 w-3" /></button>
                                                </div>
                                            )}
                                        </div>

                                        <div className={`grid transition-all duration-300 ease-out ${classCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
                                            <div className="overflow-hidden">
                                                <div className="ml-4 mt-0.5 space-y-0.5 pl-2" role="group">
                                                    {chapters.map(({ chapterName, worksheets: chapterWorksheets }) => {
                                                        const chapterKey = `${className}::${chapterName}`;
                                                        const chapterExpanded = expandedChapters[chapterKey] ?? chapters.length === 1;
                                                        const isChapterRenaming = treeRename?.type === 'chapter' && treeRename.className === className && treeRename.chapterName === chapterName;
                                                        const isChapterSelected = treeFilter?.type === 'chapter' && treeFilter.className === className && treeFilter.chapterName === chapterName;

                                                        return (
                                                            <div key={chapterKey} role="treeitem" aria-expanded={chapterExpanded} className="group/chapter">
                                                                <div className={`flex items-center gap-1 rounded-lg px-1.5 transition ${isChapterSelected ? 'bg-[#eef4f3] text-[#19788c]' : 'hover:bg-[#f4f2ec]'}`}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setExpandedChapters((current) => ({
                                                                            ...current,
                                                                            [chapterKey]: !chapterExpanded,
                                                                        }))}
                                                                        className="grid h-7 w-6 shrink-0 place-items-center rounded-md text-[#788284] focus:outline-none focus:ring-2 focus:ring-[#19788c]/15"
                                                                        aria-label={`${chapterExpanded ? 'Masquer' : 'Afficher'} les fiches de ${chapterName}`}
                                                                    >
                                                                        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${chapterExpanded ? '' : '-rotate-90'}`} />
                                                                    </button>
                                                                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#81983f]" />
                                                                    {isChapterRenaming ? (
                                                                        <form onSubmit={(event) => { event.preventDefault(); saveTreeRename(); }} className="min-w-0 flex-1">
                                                                            <input autoFocus value={treeRenameValue} onChange={(event) => setTreeRenameValue(event.target.value)} onBlur={saveTreeRename} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); cancelTreeRename(); } }} className="w-full border-b border-[#19788c] bg-transparent text-xs font-bold text-[#4c585b] outline-none" aria-label="Renommer le chapitre" />
                                                                        </form>
                                                                    ) : (
                                                                        <button type="button" onClick={() => selectTreeChapter(className, chapterName)} onDoubleClick={() => startTreeRename({ type: 'chapter', className, chapterName }, chapterName)} className="min-w-0 flex-1 truncate py-1.5 text-left text-xs font-bold text-[#4c585b] outline-none" title="Double-cliquez pour renommer">
                                                                            {chapterName}
                                                                        </button>
                                                                    )}
                                                                    <span className="grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold text-[#9aa3a5]">{chapterWorksheets.length}</span>
                                                                    <div className="flex items-center opacity-0 transition-opacity group-hover/chapter:opacity-100 group-focus-within/chapter:opacity-100">
                                                                        <button type="button" onClick={() => startTreeRename({ type: 'chapter', className, chapterName }, chapterName)} className="grid h-5 w-5 place-items-center rounded text-[#788284] hover:bg-[#e7f0ef] hover:text-[#19788c]" aria-label="Renommer le chapitre"><Pencil className="h-3 w-3" /></button>
                                                                    </div>
                                                                </div>

                                                                <div className={`grid transition-all duration-300 ease-out ${chapterExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                                                    <div className="overflow-hidden">
                                                                        <div className="ml-6 mt-0.5 space-y-0.5 py-0.5 pl-2" role="group">
                                                                            {chapterWorksheets.map((worksheet) => {
                                                                                const isWorksheetRenaming = treeRename?.type === 'worksheet' && treeRename.worksheetId === worksheet.id;
                                                                                const isWorksheetSelected = treeFilter?.type === 'worksheet' && treeFilter.worksheetId === worksheet.id;

                                                                                return (
                                                                                    <div key={worksheet.id} className={`group/fiche relative flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-[#717b7d] transition hover:bg-[#f4f2ec] hover:text-[#19788c] ${isWorksheetSelected ? 'bg-[#eef4f3] text-[#19788c]' : ''}`}>
                                                                                        <FileText className="h-3.5 w-3.5 shrink-0" />
                                                                                        {isWorksheetRenaming ? (
                                                                                            <form onSubmit={(event) => { event.preventDefault(); saveTreeRename(); }} className="min-w-0 flex-1">
                                                                                                <input autoFocus value={treeRenameValue} onChange={(event) => setTreeRenameValue(event.target.value)} onBlur={saveTreeRename} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); cancelTreeRename(); } }} className="w-full border-b border-[#19788c] bg-transparent text-[11px] font-semibold text-[#4c585b] outline-none" aria-label="Renommer la fiche" />
                                                                                            </form>
                                                                                        ) : (
                                                                                            <button type="button" onClick={() => selectTreeWorksheet(worksheet.id)} onDoubleClick={() => startTreeRename({ type: 'worksheet', worksheetId: worksheet.id }, worksheet.name)} className="min-w-0 flex-1 truncate text-left outline-none" title="Double-cliquez pour renommer">{worksheet.name}</button>
                                                                                        )}
                                                                                        <div className="flex items-center opacity-0 transition-opacity group-hover/fiche:opacity-100 group-focus-within/fiche:opacity-100">
                                                                                            <button type="button" onClick={() => setMovingWorksheetId((current) => current === worksheet.id ? null : worksheet.id)} className="grid h-5 w-5 place-items-center rounded hover:bg-[#e9f0df] hover:text-[#81983f]" title="Déplacer vers une classe" aria-label="Déplacer vers une classe"><FolderInput className="h-3 w-3" /></button>
                                                                                            <button type="button" onClick={() => startTreeRename({ type: 'worksheet', worksheetId: worksheet.id }, worksheet.name)} className="grid h-5 w-5 place-items-center rounded hover:bg-[#dceceb]" aria-label="Renommer la fiche"><Pencil className="h-3 w-3" /></button>
                                                                                            <button type="button" onClick={() => handleDeleteWorksheet(worksheet.id)} className="grid h-5 w-5 place-items-center rounded hover:bg-red-50 hover:text-red-600" aria-label="Supprimer la fiche"><Trash2 className="h-3 w-3" /></button>
                                                                                            <button type="button" onClick={() => onSelectWorksheet(worksheet.id)} className="grid h-5 w-5 place-items-center rounded hover:bg-[#dceceb]" aria-label="Ouvrir la fiche"><ChevronRight className="h-3.5 w-3.5" /></button>
                                                                                        </div>

                                                                                        {movingWorksheetId === worksheet.id && (
                                                                                            <select
                                                                                                autoFocus
                                                                                                value={worksheet.content.settings?.className || ''}
                                                                                                onChange={(event) => { onAssignWorksheetClass(worksheet.id, event.target.value); setMovingWorksheetId(null); }}
                                                                                                onBlur={() => setMovingWorksheetId(null)}
                                                                                                className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-[#d7e1c9] bg-white px-2 py-1 text-[11px] font-bold text-[#4c585b] shadow-sm outline-none"
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
