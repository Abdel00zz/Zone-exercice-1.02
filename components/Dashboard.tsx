import React, { useState, useMemo } from 'react';
import type { Worksheet, WorksheetContent } from '../types';
import { Trash2, Pencil, Search, Code, Calendar, ChevronRight, ChevronDown, FileText, Folder, FolderInput, FolderPlus, BookOpen, Plus, Cloud, Settings, PanelLeftClose, PanelLeftOpen, Maximize2 } from 'lucide-react';
import JSONManagerModal from './JSONManagerModal';
import WorksheetThumbnail from './WorksheetThumbnail';
import type { CloudSyncStatus } from '../hooks/useCloudSync';

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
    const [treeFilter, setTreeFilter] = useState<{ type: 'class'; className: string } | { type: 'chapter'; className: string; chapterName: string } | { type: 'worksheet'; worksheetId: string } | null>(null);

    const getWorksheetClassName = (worksheet: Worksheet) => worksheet.content?.settings?.className?.trim() || 'Non classé';
    const getWorksheetChapterName = (worksheet: Worksheet) => worksheet.content?.chapter?.trim() || worksheet.name || 'Sans chapitre';

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

    const visibleWorksheets = sortedWorksheets.slice(0, visibleCount);

    const treeFilterLabel = useMemo(() => {
        if (!treeFilter) return null;
        if (treeFilter.type === 'class') return `Classe : ${treeFilter.className}`;
        if (treeFilter.type === 'chapter') return `Chapitre : ${treeFilter.chapterName}`;
        const worksheet = worksheets.find((item) => item.id === treeFilter.worksheetId);
        return worksheet ? `Fiche : ${worksheet.name}` : null;
    }, [treeFilter, worksheets]);

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
        const classes = new Map<string, Map<string, Worksheet[]>>();
        worksheetClasses.forEach((className) => {
            const normalizedName = className.trim();
            if (normalizedName) classes.set(normalizedName, new Map());
        });

        [...worksheets]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .forEach((worksheet) => {
                const className = getWorksheetClassName(worksheet);
                const chapterName = getWorksheetChapterName(worksheet);
                const chapters = classes.get(className) || new Map<string, Worksheet[]>();
                const chapterWorksheets = chapters.get(chapterName) || [];
                chapterWorksheets.push(worksheet);
                chapters.set(chapterName, chapterWorksheets);
                classes.set(className, chapters);
            });

        return Array.from(classes, ([className, chapters]) => ({
            className,
            worksheetCount: Array.from(chapters.values()).reduce((sum, list) => sum + list.length, 0),
            chapters: Array.from(chapters, ([chapterName, chapterWorksheets]) => ({ chapterName, worksheets: chapterWorksheets })),
        })).sort((a, b) => {
            if (a.className === 'Non classé') return 1;
            if (b.className === 'Non classé') return -1;
            return a.className.localeCompare(b.className, 'fr');
        });
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
                <button
                    type="button"
                    onClick={() => setSidebarCollapsed((current) => !current)}
                    className={`absolute top-4 z-20 hidden h-10 w-10 place-items-center bg-transparent text-[#19788c] transition hover:-translate-y-0.5 hover:text-[#11677a] focus:outline-none lg:grid ${sidebarCollapsed ? 'left-4' : 'left-[228px] xl:left-[258px]'}`}
                    title={sidebarCollapsed ? 'Développer la barre latérale' : 'Réduire la barre latérale'}
                    aria-label={sidebarCollapsed ? 'Développer la barre latérale' : 'Réduire la barre latérale'}
                >
                    {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </button>
                {/* ── Navigation / outils ── */}
                <aside className={`min-w-0 bg-[#fffefa] px-5 py-5 sm:px-7 sm:py-6 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:py-6 ${sidebarCollapsed ? 'lg:w-0 lg:overflow-hidden lg:p-0 lg:opacity-0 lg:pointer-events-none' : 'lg:px-4 xl:px-5'}`}>
                    <div className="flex flex-col xl:h-full">
                        <div className={`mb-4 flex items-start ${sidebarCollapsed ? 'justify-center' : 'justify-between gap-2'} xl:mb-5`}>
                            {sidebarCollapsed ? (
                                <button type="button" onClick={() => setSidebarCollapsed(false)} className="grid h-11 w-11 place-items-center rounded-2xl bg-[#172126] text-white shadow-sm transition hover:bg-[#25363c] focus:outline-none focus:ring-4 focus:ring-[#19788c]/15" title="Développer la barre latérale" aria-label="Développer la barre latérale"><PanelLeftOpen className="h-5 w-5" /></button>
                            ) : (
                                <div>
                                    <h1 className="max-w-[190px] font-serif text-[1.65rem] font-semibold leading-[1.06] tracking-[-0.035em] text-[#111719] sm:text-[1.85rem]">
                                        Mes Fiches d'Exercices
                                    </h1>
                                    <p className="mt-2 text-xs font-semibold text-[#697478]">
                                        {worksheets.length} fiche{worksheets.length !== 1 ? 's' : ''} disponible{worksheets.length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            )}
                        </div>

                        <nav className={`grid gap-2 ${sidebarCollapsed ? 'grid-cols-1' : 'grid-cols-2'}`} aria-label="Actions du tableau de bord">
                            <button
                                type="button"
                                onClick={onOpenSyncPanel}
                                className={`relative flex rounded-2xl bg-[#dceceb] text-left text-[#19788c] transition hover:bg-[#cbe4e3] focus:outline-none focus:ring-4 focus:ring-[#19788c]/15 ${sidebarCollapsed ? 'h-11 items-center justify-center' : 'min-h-[74px] flex-col items-start justify-between px-3 py-2.5'}`}
                                title="Synchronisation PC / Tablette"
                                aria-label="Synchronisation PC / Tablette"
                            >
                                <span className="relative text-[#19788c]">
                                    <Cloud className="h-4 w-4" />
                                    {cloudSyncStatus !== 'disconnected' && (
                                        <span
                                            className={`absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#dceceb] ${
                                                cloudSyncStatus === 'error' ? 'bg-red-500' : cloudSyncStatus === 'syncing' ? 'bg-amber-400' : 'bg-emerald-500'
                                            }`}
                                        />
                                    )}
                                </span>
                                <span className={sidebarCollapsed ? 'sr-only' : 'text-[10px] font-bold leading-tight text-[#435054]'}>Synchronisation<br />PC / Tablette</span>
                            </button>

                            <button
                                type="button"
                                onClick={onOpenConfiguration}
                                className={`flex rounded-2xl bg-[#f4f1eb] text-left text-xs font-bold text-[#435054] transition hover:bg-[#e7f0ef] hover:text-[#19788c] focus:outline-none focus:ring-4 focus:ring-[#19788c]/10 ${sidebarCollapsed ? 'h-11 items-center justify-center' : 'min-h-[74px] flex-col items-start justify-between px-3 py-2.5'}`}
                                title="Configuration"
                                aria-label="Configuration"
                            >
                                <Settings className="h-4 w-4" />
                                <span className={sidebarCollapsed ? 'sr-only' : 'text-[10px] leading-tight'}>Configuration</span>
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

                {/* ── Bibliothèque de fiches ── */}
                <main className="min-w-0 px-5 py-7 sm:px-8 sm:py-9 lg:px-12 xl:px-14 xl:py-12 2xl:px-16">
                    <header className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
                        <div className="hidden lg:block">
                            <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-[#111719] sm:text-[2.65rem]">
                                Mes Fiches d'Exercices
                            </h2>
                            <p className="mt-2 text-sm font-semibold text-[#697478]">
                                {worksheets.length} fiche{worksheets.length !== 1 ? 's' : ''} disponible{worksheets.length !== 1 ? 's' : ''}
                            </p>
                            {treeFilterLabel && (
                                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-[#9a7400]">
                                    <span>{treeFilterLabel}</span>
                                    <button type="button" onClick={() => { setTreeFilter(null); setVisibleCount(6); }} className="text-[#19788c] transition hover:text-[#11677a]" title="Afficher toutes les fiches">Tout afficher</button>
                                </div>
                            )}
                        </div>

                        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                            <div className="relative w-full sm:w-[280px] lg:w-[320px]">
                                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#19788c]" />
                                <input
                                    type="text"
                                    placeholder="Rechercher..."
                                    value={searchQuery}
                                    onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(6); }}
                                    className="w-full rounded-full border border-[#d5d8d4] bg-[#faf9f6] py-3 pl-12 pr-5 text-[15px] font-semibold text-[#172126] outline-none transition placeholder:text-[#8a9293] hover:border-[#b9c8c8] focus:border-[#19788c] focus:ring-4 focus:ring-[#19788c]/10"
                                    aria-label="Rechercher une fiche par nom"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleOpenManager}
                                className="inline-flex h-[46px] shrink-0 items-center justify-center gap-2 rounded-full bg-[#172126] px-5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(23,33,38,0.14)] transition hover:-translate-y-0.5 hover:bg-[#25363c] focus:outline-none focus:ring-4 focus:ring-[#19788c]/20"
                            >
                                <Plus className="h-4 w-4" />
                                Créer une nouvelle fiche
                            </button>
                        </div>
                    </header>

                    {sortedWorksheets.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:gap-6">
                                {visibleWorksheets.map((ws) => {
                                    const classNameLabel = ws.content?.settings?.className?.trim() || '';
                                    const exerciseCount = ws.content?.exercises?.length || 0;

                                    return (
                                        <article
                                            key={ws.id}
                                            className="group flex h-full min-w-0 cursor-pointer flex-col outline-none"
                                            onClick={() => onSelectWorksheet(ws.id)}
                                            onDoubleClick={(e) => { e.stopPropagation(); handleEditJson(ws); }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    onSelectWorksheet(ws.id);
                                                }
                                            }}
                                            tabIndex={0}
                                            title="Cliquez pour ouvrir"
                                        >
                                            <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[18px] border border-[#d4d8d5] bg-[#f7f6f2] shadow-[0_5px_18px_rgba(23,33,38,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-[#b9c4c2] hover:shadow-[0_18px_38px_rgba(23,33,38,0.15)] active:scale-[0.99] group-focus-visible:ring-4 group-focus-visible:ring-[#19788c]/20">
                                                {/* Surface de prévisualisation, inspirée des vignettes de lecteurs PDF. */}
                                                <div className="relative bg-[#e4e4e1] p-2.5">
                                                    <div
                                                        className="absolute right-4 top-4 z-20 flex items-center gap-0.5 rounded-full bg-white/95 p-0.5 opacity-0 shadow-[0_3px_12px_rgba(23,33,38,0.16)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRename(ws)}
                                                            className="grid min-h-[28px] min-w-[28px] place-items-center rounded-full text-[#697478] transition hover:bg-[#edf1ef] hover:text-[#172126] active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#19788c]/20"
                                                            title="Renommer"
                                                            aria-label="Renommer la fiche"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEditJson(ws)}
                                                            className="grid min-h-[28px] min-w-[28px] place-items-center rounded-full text-[#697478] transition hover:bg-[#edf1ef] hover:text-[#172126] active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#19788c]/20"
                                                            title="Éditer JSON"
                                                            aria-label="Éditer le JSON de la fiche"
                                                        >
                                                            <Code className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteWorksheet(ws.id)}
                                                            className="grid min-h-[28px] min-w-[28px] place-items-center rounded-full text-[#697478] transition hover:bg-red-50 hover:text-red-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                                                            title="Supprimer"
                                                            aria-label="Supprimer la fiche"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                    <div className="aspect-[210/297] overflow-hidden bg-white shadow-[0_3px_14px_rgba(23,33,38,0.2)] transition-transform duration-500 group-hover:scale-[1.012]">
                                                        <WorksheetThumbnail worksheet={ws} />
                                                    </div>
                                                    <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center opacity-0 transition-opacity group-hover:opacity-100">
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-[#172126]/85 px-2.5 py-1 text-[9px] font-bold text-white shadow-lg backdrop-blur-sm">
                                                            <Maximize2 className="h-3 w-3" />
                                                            Ouvrir la fiche
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Cartouche du document. */}
                                                <div className="flex min-h-[96px] flex-col bg-white px-3.5 pb-3 pt-2.5">
                                                  <div className="min-w-0 flex-grow">
                                                    {renamingId === ws.id ? (
                                                        <form onSubmit={handleSaveRename} onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                type="text"
                                                                value={newName}
                                                                onChange={(e) => setNewName(e.target.value)}
                                                                onBlur={handleSaveRename}
                                                                autoFocus
                                                                className="w-full border-b-2 border-[#19788c] bg-transparent pb-1 font-sans text-sm font-bold tracking-tight text-[#172126] outline-none"
                                                            />
                                                        </form>
                                                    ) : (
                                                        <h3 className="line-clamp-2 font-sans text-sm font-bold leading-snug tracking-tight text-[#172126]">
                                                            {ws.name}
                                                        </h3>
                                                    )}
                                                    {classNameLabel && (
                                                        <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.08em] text-[#19788c]">{classNameLabel}</p>
                                                    )}
                                                  </div>

                                                <div className="mt-2 flex items-center justify-between border-t border-[#ecefed] pt-2 text-[10px] font-medium text-[#6e7a7d]">
                                                    <span className="inline-flex items-center gap-2">
                                                        <Calendar className="h-3.5 w-3.5 text-[#8a9293]" strokeWidth={2} />
                                                        {new Date(ws.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                                        <span className="opacity-50">·</span>
                                                        {exerciseCount} ex.
                                                    </span>
                                                    <span className="inline-flex items-center text-[#aab2b1] transition group-hover:translate-x-0.5 group-hover:text-[#19788c]">
                                                        <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                                                    </span>
                                                </div>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
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

        </div>
    );
};

export default Dashboard;
