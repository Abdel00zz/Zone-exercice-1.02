import React from 'react';
import type { Worksheet } from '../types';
import { Info } from 'lucide-react';
import WorksheetThumbnail from './WorksheetThumbnail';

interface WorksheetCardProps {
    worksheet: Worksheet;
    renamingId?: string | null;
    newName?: string;
    onSelectWorksheet: (id: string) => void;
    onSaveRename?: (e: React.FormEvent) => void;
    onNewNameChange?: (name: string) => void;
    onShowInfo: (worksheet: Worksheet) => void;
}

export const WorksheetCard: React.FC<WorksheetCardProps> = ({
    worksheet,
    renamingId,
    newName,
    onSelectWorksheet,
    onSaveRename,
    onNewNameChange,
    onShowInfo,
}) => {
    return (
        <article
            className="group flex h-full min-w-0 cursor-pointer flex-col outline-none"
            onClick={() => onSelectWorksheet(worksheet.id)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectWorksheet(worksheet.id);
                }
            }}
            tabIndex={0}
            title={`${worksheet.name} — Cliquez pour ouvrir, ou cliquez sur 'i' pour les options`}
        >
            <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-dash-border bg-dash-card shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:border-dash-teal/40 group-focus-visible:ring-4 group-focus-visible:ring-dash-teal/20">
                {/* Surface de prévisualisation */}
                <div className="relative bg-dash-preview p-2.5">
                    <div className="aspect-[210/297] overflow-hidden rounded-lg bg-white shadow-[0_2px_8px_rgba(23,33,38,0.08)] transition-transform duration-200 group-hover:scale-[1.01]">
                        <WorksheetThumbnail worksheet={worksheet} />
                    </div>
                </div>

                {/* Cartouche du document */}
                <div className="flex min-h-[52px] flex-col justify-center bg-white px-3.5 py-2.5">
                    <div className="min-w-0 flex-grow">
                        {renamingId === worksheet.id && onSaveRename && onNewNameChange ? (
                            <form onSubmit={onSaveRename} onClick={(e) => e.stopPropagation()}>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => onNewNameChange(e.target.value)}
                                    onBlur={onSaveRename}
                                    autoFocus
                                    className="w-full border-b-2 border-dash-teal bg-transparent pb-1 font-sans text-sm font-bold tracking-tight text-dash-main outline-none"
                                />
                            </form>
                        ) : (
                            <div className="flex items-center justify-between gap-1.5">
                                <h3 className="line-clamp-2 font-sans text-xs font-bold leading-snug tracking-tight text-dash-main group-hover:text-dash-teal transition-colors">
                                    {worksheet.name}
                                </h3>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onShowInfo(worksheet);
                                    }}
                                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-dash-muted bg-dash-bg transition hover:bg-dash-teal hover:text-white focus:outline-none focus:ring-2 focus:ring-dash-teal/20"
                                    title="Détails & Actions"
                                    aria-label="Options de la fiche"
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
