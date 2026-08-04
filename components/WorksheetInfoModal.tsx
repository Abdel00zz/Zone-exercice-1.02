import React, { useState, useEffect } from 'react';
import type { Worksheet } from '../types';
import { Info, X, Pencil, Code, Trash2, Check, ExternalLink, AlertTriangle, BookOpen, Layers, Calendar, Tag } from 'lucide-react';
import WorksheetThumbnail from './WorksheetThumbnail';

interface WorksheetInfoModalProps {
    worksheet: Worksheet | null;
    worksheetClasses?: string[];
    onClose: () => void;
    getClassName: (worksheet: Worksheet) => string;
    onRenameWorksheet?: (id: string, newName: string) => void;
    onEditJson?: (worksheet: Worksheet) => void;
    onDeleteWorksheet?: (id: string) => void;
    onSelectWorksheet?: (id: string) => void;
    onAssignWorksheetClass?: (worksheetId: string, className: string) => void;
}

export const WorksheetInfoModal: React.FC<WorksheetInfoModalProps> = ({
    worksheet,
    worksheetClasses = [],
    onClose,
    getClassName,
    onRenameWorksheet,
    onEditJson,
    onDeleteWorksheet,
    onSelectWorksheet,
    onAssignWorksheetClass,
}) => {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (worksheet) {
            setNameInput(worksheet.name);
            setIsEditingTitle(false);
            setShowDeleteConfirm(false);
        }
    }, [worksheet]);

    if (!worksheet) return null;

    const handleSaveTitle = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = nameInput.trim();
        if (trimmed && trimmed !== worksheet.name && onRenameWorksheet) {
            onRenameWorksheet(worksheet.id, trimmed);
        }
        setIsEditingTitle(false);
    };

    const handleCancelEditTitle = () => {
        setNameInput(worksheet.name);
        setIsEditingTitle(false);
    };

    const handleConfirmDelete = () => {
        if (onDeleteWorksheet) {
            onDeleteWorksheet(worksheet.id);
            onClose();
        }
    };

    const currentClassName = getClassName(worksheet);

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-5 backdrop-blur-md transition-all duration-300 animate-fadeIn" 
            onClick={onClose}
        >
            <div 
                className="relative w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden rounded-3xl bg-[#fffefa] p-4 sm:p-6 shadow-2xl border border-[#e5ebd9] transition-all duration-300 scale-100"
                onClick={(e) => e.stopPropagation()}
            >
                {/* En-tête Compact & Moderne */}
                <div className="flex shrink-0 items-center justify-between border-b border-[#e8ece7] pb-3.5">
                    <div className="flex items-center gap-3 text-[#19788c]">
                        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#e7f0ef] text-[#19788c] shadow-sm">
                            <Info className="h-4 w-4" />
                        </span>
                        <div>
                            <h3 className="font-display text-base sm:text-lg font-bold text-[#172126] leading-snug">Fiche d'exercice</h3>
                            <p className="text-xs font-medium text-[#697478]">Aperçu, réglages de classe et actions rapides</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-9 w-9 place-items-center rounded-full text-[#697478] hover:bg-[#edf1ef] hover:text-[#172126] transition active:scale-95"
                        aria-label="Fermer"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Contenu Réparti pour Tablette / Desktop (Grid 2 colonnes fluide) */}
                <div className="mt-4 flex-grow overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                        
                        {/* Colonne Gauche : Aperçu Miniature A4 & Action Principale (4/12 sur Tablette/Desktop) */}
                        <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-3 rounded-2xl bg-[#f5f4f0] p-3.5 border border-[#e2dfd7]">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#697478] flex items-center gap-1.5">
                                <BookOpen className="h-3.5 w-3.5 text-[#19788c]" /> Aperçu du Document
                            </span>
                            
                            <div className="aspect-[210/297] w-full overflow-hidden rounded-xl bg-white shadow-md border border-[#dedbd2] relative group">
                                <WorksheetThumbnail worksheet={worksheet} />
                            </div>

                            {onSelectWorksheet && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        onSelectWorksheet(worksheet.id);
                                    }}
                                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#172126] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[#25363c] transition active:scale-95"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    Ouvrir la fiche
                                </button>
                            )}
                        </div>

                        {/* Colonne Droite : Formulaires & Détails (8/12 sur Tablette/Desktop) */}
                        <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-3.5">
                            
                            {/* Titre & Renommage */}
                            <div className="rounded-2xl bg-[#faf9f6] p-3.5 border border-[#e8ece7]">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#697478]">Titre de la fiche</span>
                                {isEditingTitle ? (
                                    <form onSubmit={handleSaveTitle} className="mt-1.5 flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={nameInput}
                                            onChange={(e) => setNameInput(e.target.value)}
                                            autoFocus
                                            className="flex-grow rounded-xl border border-[#19788c] bg-white px-3 py-1.5 text-xs sm:text-sm font-bold text-[#172126] outline-none focus:ring-2 focus:ring-[#19788c]/20"
                                        />
                                        <button
                                            type="submit"
                                            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#19788c] text-white hover:bg-[#11677a] transition active:scale-95"
                                            title="Enregistrer"
                                        >
                                            <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCancelEditTitle}
                                            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#e8ece7] text-[#697478] hover:bg-[#d8ded6] transition active:scale-95"
                                            title="Annuler"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </form>
                                ) : (
                                    <div className="mt-1 flex items-center justify-between gap-2">
                                        <p className="font-bold text-[#172126] text-sm sm:text-base leading-snug">{worksheet.name}</p>
                                        {onRenameWorksheet && (
                                            <button
                                                type="button"
                                                onClick={() => setIsEditingTitle(true)}
                                                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#d2dad6] bg-white px-2.5 py-1 text-xs font-bold text-[#435054] hover:border-[#19788c] hover:bg-[#e7f0ef] hover:text-[#19788c] transition active:scale-95"
                                                title="Modifier le titre"
                                            >
                                                <Pencil className="h-3 w-3" />
                                                Renommer
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Attributs Métadonnées en Grille */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* Affectation de Classe */}
                                <div className="rounded-2xl bg-[#faf9f6] p-3 border border-[#e8ece7] flex flex-col justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#697478] flex items-center gap-1">
                                        <Tag className="h-3 w-3 text-[#19788c]" /> Classe
                                    </span>
                                    {onAssignWorksheetClass && worksheetClasses.length > 0 ? (
                                        <select
                                            value={currentClassName}
                                            onChange={(e) => onAssignWorksheetClass(worksheet.id, e.target.value)}
                                            className="mt-1.5 w-full rounded-xl border border-[#d2dad6] bg-white px-2 py-1 text-xs font-semibold text-[#19788c] outline-none focus:ring-2 focus:ring-[#19788c]/20"
                                        >
                                            <option value="Non classé">Non classé</option>
                                            {worksheetClasses.map((cls) => (
                                                <option key={cls} value={cls}>{cls}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <p className="mt-1 font-semibold text-xs text-[#19788c] truncate">
                                            {currentClassName}
                                        </p>
                                    )}
                                </div>

                                {/* Compte d'Exercices */}
                                <div className="rounded-2xl bg-[#faf9f6] p-3 border border-[#e8ece7] flex flex-col justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#697478] flex items-center gap-1">
                                        <Layers className="h-3 w-3 text-[#19788c]" /> Exercices
                                    </span>
                                    <p className="mt-1 font-bold text-xs sm:text-sm text-[#172126]">
                                        {worksheet.content.exercises?.length || 0} exercice(s)
                                    </p>
                                </div>
                            </div>

                            {/* Chapitre */}
                            {worksheet.content.chapter && (
                                <div className="rounded-2xl bg-[#faf9f6] p-3 border border-[#e8ece7]">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#697478]">Chapitre</span>
                                    <p className="mt-0.5 font-semibold text-xs sm:text-sm text-[#172126]">{worksheet.content.chapter}</p>
                                </div>
                            )}

                            {/* Horodatage & Version */}
                            <div className="rounded-2xl bg-[#faf9f6] p-3 border border-[#e8ece7] space-y-1.5 text-xs text-[#435054]">
                                <div className="flex justify-between items-center">
                                    <span className="flex items-center gap-1 text-[11px] text-[#697478]">
                                        <Calendar className="h-3 w-3" /> Date de création
                                    </span>
                                    <span className="font-semibold text-[#172126] text-[11px]">
                                        {new Date(worksheet.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-1 border-t border-[#e8ece7]">
                                    <span className="text-[11px] text-[#697478]">Version du document</span>
                                    <span className="font-mono text-[11px] text-[#172126] font-medium">v{worksheet.content.version || '1.0'}</span>
                                </div>
                            </div>

                            {/* Zone de confirmation de suppression */}
                            {showDeleteConfirm && (
                                <div className="rounded-2xl border border-red-200 bg-red-50/80 p-3.5 animate-fadeIn">
                                    <div className="flex items-start gap-2.5">
                                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-red-900">Confirmer la suppression</p>
                                            <p className="mt-0.5 text-xs text-red-700 leading-relaxed">
                                                Voulez-vous vraiment supprimer la fiche « {worksheet.name} » ? Action irréversible.
                                            </p>
                                            <div className="mt-2.5 flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleConfirmDelete}
                                                    className="rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition active:scale-95"
                                                >
                                                    Oui, supprimer
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowDeleteConfirm(false)}
                                                    className="rounded-xl bg-white border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100/50 transition"
                                                >
                                                    Annuler
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>

                {/* Pied de Page d'Actions Intégré */}
                <div className="mt-4 flex shrink-0 items-center justify-between border-t border-[#e8ece7] pt-3.5">
                    <div className="flex items-center gap-2">
                        {onEditJson && (
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    onEditJson(worksheet);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[#cbe0df] bg-[#f1f8f7] px-3.5 py-2 text-xs font-bold text-[#19788c] hover:bg-[#dceceb] hover:text-[#11677a] transition active:scale-95"
                                title="Éditer le JSON de la fiche"
                            >
                                <Code className="h-3.5 w-3.5" />
                                Modifier le Code (JSON)
                            </button>
                        )}

                        {onDeleteWorksheet && !showDeleteConfirm && (
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50/50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 hover:border-red-200 transition active:scale-95"
                                title="Supprimer la fiche"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Supprimer
                            </button>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl bg-[#e8ece7] px-4 py-2 text-xs font-bold text-[#435054] hover:bg-[#d8ded6] transition active:scale-95"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WorksheetInfoModal;
