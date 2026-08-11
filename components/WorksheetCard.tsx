import React from 'react';
import type { PaperTheme, Worksheet } from '../types';
import { Info } from 'lucide-react';
import WorksheetThumbnail from './WorksheetThumbnail';
import MathText from './MathText';
import { resolvePaperTheme } from '../utils/paperThemes';
import type { WorksheetSearchMatch, WorksheetSearchNavigation } from '../utils/worksheetSearch';

interface WorksheetCardProps {
    worksheet: Worksheet;
    renamingId?: string | null;
    newName?: string;
    onSelectWorksheet: (id: string, navigation?: WorksheetSearchNavigation) => void;
    onSaveRename?: (e: React.FormEvent) => void;
    onNewNameChange?: (name: string) => void;
    onShowInfo: (worksheet: Worksheet) => void;
    fallbackPaperTheme?: PaperTheme;
    searchMatch?: WorksheetSearchMatch;
}

export const WorksheetCard: React.FC<WorksheetCardProps> = ({
    worksheet,
    renamingId,
    newName,
    onSelectWorksheet,
    onSaveRename,
    onNewNameChange,
    onShowInfo,
    fallbackPaperTheme = 'classic',
    searchMatch,
}) => {
    const paperTheme = resolvePaperTheme(worksheet.content.settings?.paperTheme, fallbackPaperTheme);
    return (
        <article
            className="group flex h-full min-w-0 cursor-pointer flex-col outline-none"
            onClick={() => onSelectWorksheet(worksheet.id, searchMatch?.target)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectWorksheet(worksheet.id, searchMatch?.target);
                }
            }}
            tabIndex={0}
            title={`${worksheet.name} — Cliquez pour ouvrir, ou cliquez sur 'i' pour les options`}
        >
            <div className={`paper-theme-${paperTheme} relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-dash-border bg-dash-card shadow-sm transition-all duration-200 group-hover:border-[var(--paper-title)]/40 group-hover:shadow-md group-focus-visible:ring-4 group-focus-visible:ring-dash-teal/20`}>
                {/* Surface de prévisualisation */}
                <div className="relative bg-dash-preview p-2.5">
                    <div className="aspect-[210/297] overflow-hidden rounded-lg bg-white shadow-[0_2px_8px_rgba(23,33,38,0.08)] transition-transform duration-200 group-hover:scale-[1.01]">
                        <WorksheetThumbnail worksheet={worksheet} fallbackPaperTheme={fallbackPaperTheme} />
                    </div>
                </div>

                {/* Cartouche du document */}
                <div className="relative flex min-h-[52px] flex-col justify-center bg-white px-3.5 py-2.5">
                    <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--paper-title-ornament)] to-transparent opacity-70" />
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
                                <h3 className="line-clamp-2 font-sans text-xs font-bold leading-snug tracking-tight text-dash-main transition-colors group-hover:text-[var(--paper-title)]">
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
                        {searchMatch?.excerpt && renamingId !== worksheet.id && (
                            <div className="mt-2 rounded-xl border border-dash-border/70 bg-dash-bg/70 px-2.5 py-2">
                                <span className="mb-0.5 block text-[8px] font-extrabold uppercase tracking-[0.12em] text-[var(--paper-title)]">
                                    {searchMatch.fieldLabel}
                                </span>
                                {searchMatch.mathText ? (
                                    <div className="line-clamp-2 text-[10px] font-medium leading-relaxed text-dash-muted">
                                        <MathText text={searchMatch.mathText} />
                                    </div>
                                ) : (
                                    <p className="line-clamp-2 text-[10px] font-medium leading-relaxed text-dash-muted">
                                        {searchMatch.excerpt}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </article>
    );
};

export default WorksheetCard;
