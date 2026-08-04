import React from 'react';
import type { Worksheet } from '../types';
import { Info, X } from 'lucide-react';

interface WorksheetInfoModalProps {
    worksheet: Worksheet | null;
    onClose: () => void;
    getClassName: (worksheet: Worksheet) => string;
}

export const WorksheetInfoModal: React.FC<WorksheetInfoModalProps> = ({
    worksheet,
    onClose,
    getClassName,
}) => {
    if (!worksheet) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fadeIn" 
            onClick={onClose}
        >
            <div 
                className="w-full max-w-md overflow-hidden rounded-3xl bg-[#fffefa] p-6 shadow-2xl border border-[#e5ebd9] transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-[#e8ece7] pb-4">
                    <div className="flex items-center gap-2.5 text-[#19788c]">
                        <Info className="h-5 w-5" />
                        <h3 className="font-display text-base font-bold text-[#172126]">Détails de la fiche</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-8 w-8 place-items-center rounded-full text-[#697478] hover:bg-[#edf1ef] hover:text-[#172126] transition"
                        aria-label="Fermer"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-5 space-y-3.5 text-sm">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#697478]">Titre de la fiche</span>
                        <p className="mt-0.5 font-bold text-[#172126] text-base leading-snug">{worksheet.name}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-[#faf9f6] p-3 border border-[#e8ece7]">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#697478]">Classe</span>
                            <p className="mt-1 font-semibold text-[#19788c] truncate">
                                {getClassName(worksheet)}
                            </p>
                        </div>
                        <div className="rounded-2xl bg-[#faf9f6] p-3 border border-[#e8ece7]">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#697478]">Exercices</span>
                            <p className="mt-1 font-semibold text-[#172126]">
                                {worksheet.content.exercises?.length || 0} exercice(s)
                            </p>
                        </div>
                    </div>

                    {worksheet.content.chapter && (
                        <div className="rounded-2xl bg-[#faf9f6] p-3 border border-[#e8ece7]">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#697478]">Chapitre</span>
                            <p className="mt-1 font-medium text-[#172126]">{worksheet.content.chapter}</p>
                        </div>
                    )}

                    <div className="rounded-2xl bg-[#faf9f6] p-3 border border-[#e8ece7] space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#697478]">Historique de modification</span>
                        <div className="flex justify-between text-xs text-[#435054] pt-1.5 border-t border-[#e8ece7]">
                            <span>Date de création</span>
                            <span className="font-semibold text-[#172126]">
                                {new Date(worksheet.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                        </div>
                        <div className="flex justify-between text-xs text-[#435054]">
                            <span>Version du document</span>
                            <span className="font-mono text-xs text-[#172126]">v{worksheet.content.version || '1.0'}</span>
                        </div>
                        <div className="flex justify-between text-xs text-[#435054]">
                            <span>Stockage local</span>
                            <span className="font-semibold text-emerald-700">Enregistré (Prêt hors-ligne)</span>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full bg-[#172126] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#25363c]"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WorksheetInfoModal;
