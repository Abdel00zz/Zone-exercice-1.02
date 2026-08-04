import React from 'react';
import type { Worksheet } from '../types';
import { Pencil, Code, Trash2, Info } from 'lucide-react';
import WorksheetThumbnail from './WorksheetThumbnail';

interface WorksheetCardProps {
    worksheet: Worksheet;
    isActionMenuOpen: boolean;
    renamingId: string | null;
    newName: string;
    onSelectWorksheet: (id: string) => void;
    onToggleActionMenu: (id: string | null) => void;
    onRename: (worksheet: Worksheet) => void;
    onSaveRename: (e: React.FormEvent) => void;
    onNewNameChange: (name: string) => void;
    onEditJson: (worksheet: Worksheet) => void;
    onDeleteWorksheet: (id: string) => void;
    onShowInfo: (worksheet: Worksheet) => void;
}

export const WorksheetCard: React.FC<WorksheetCardProps> = ({
    worksheet,
    isActionMenuOpen,
    renamingId,
    newName,
    onSelectWorksheet,
    onToggleActionMenu,
    onRename,
    onSaveRename,
    onNewNameChange,
    onEditJson,
    onDeleteWorksheet,
    onShowInfo,
}) => {
    return (
        <article
            className="group flex h-full min-w-0 cursor-pointer flex-col outline-none"
            onClick={() => {
                if (isActionMenuOpen) onToggleActionMenu(null);
                else onSelectWorksheet(worksheet.id);
            }}
            onDoubleClick={(e) => { 
                e.stopPropagation(); 
                onToggleActionMenu(worksheet.id); 
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectWorksheet(worksheet.id);
                }
            }}
            onMouseLeave={() => onToggleActionMenu(null)}
            tabIndex={0}
            title="Double-cliquez pour les options, cliquez pour ouvrir"
        >
            <div className="relative flex h-full w-full flex-col overflow-hidden rounded-none border border-[#d4d8d5] bg-[#f7f6f2] shadow-sm transition-none group-focus-visible:ring-4 group-focus-visible:ring-[#19788c]/20">
                {/* Surface de prévisualisation */}
                <div className="relative bg-[#e4e4e1] p-2.5">
                    <div
                        className={`absolute right-4 top-4 z-20 flex flex-col items-center gap-1 rounded-xl bg-white/95 p-1.5 shadow-[0_3px_12px_rgba(23,33,38,0.2)] transition-opacity duration-200 ${isActionMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => { onToggleActionMenu(null); onRename(worksheet); }}
                            className="grid min-h-[32px] min-w-[32px] place-items-center rounded-lg text-[#697478] transition hover:bg-[#edf1ef] hover:text-[#172126] active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#19788c]/20"
                            title="Renommer"
                            aria-label="Renommer la fiche"
                        >
                            <Pencil className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => { onToggleActionMenu(null); onEditJson(worksheet); }}
                            className="grid min-h-[32px] min-w-[32px] place-items-center rounded-lg text-[#697478] transition hover:bg-[#edf1ef] hover:text-[#172126] active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#19788c]/20"
                            title="Éditer JSON"
                            aria-label="Éditer le JSON de la fiche"
                        >
                            <Code className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => { onToggleActionMenu(null); onDeleteWorksheet(worksheet.id); }}
                            className="grid min-h-[32px] min-w-[32px] place-items-center rounded-lg text-[#697478] transition hover:bg-red-50 hover:text-red-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                            title="Supprimer"
                            aria-label="Supprimer la fiche"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="aspect-[210/297] overflow-hidden bg-white shadow-[0_2px_8px_rgba(23,33,38,0.15)] transition-none">
                        <WorksheetThumbnail worksheet={worksheet} />
                    </div>
                </div>

                {/* Cartouche du document */}
                <div className="flex min-h-[52px] flex-col justify-center bg-white px-3.5 py-2.5">
                    <div className="min-w-0 flex-grow">
                        {renamingId === worksheet.id ? (
                            <form onSubmit={onSaveRename} onClick={(e) => e.stopPropagation()}>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => onNewNameChange(e.target.value)}
                                    onBlur={onSaveRename}
                                    autoFocus
                                    className="w-full border-b-2 border-[#19788c] bg-transparent pb-1 font-sans text-sm font-bold tracking-tight text-[#172126] outline-none"
                                />
                            </form>
                        ) : (
                            <div className="flex items-center justify-between gap-1.5">
                                <h3 className="line-clamp-2 font-sans text-xs font-bold leading-snug tracking-tight text-[#172126]">
                                    {worksheet.name}
                                </h3>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onShowInfo(worksheet);
                                    }}
                                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[#697478] transition hover:bg-[#edf1ef] hover:text-[#19788c] focus:outline-none focus:ring-2 focus:ring-[#19788c]/20"
                                    title="Informations"
                                    aria-label="Informations sur la fiche"
                                >
                                    <Info className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </article>
    );
};

export default WorksheetCard;
